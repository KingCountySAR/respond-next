import type { ActivityState, LocationState, OrganizationState } from '@respond/shared';
import { BasicEventReducers, BasicLocationEventReducers } from '@respond/shared';
import { Command } from '@respond/shared/commands';
import { EventAuthor, isLocationEvent, serviceAuthor, StampedEvent } from '@respond/shared/events';
import { filterInitialActivities } from '@respond/shared/state/activityVisibility';
import type { Activity } from '@respond/shared/types/activity';
import { ORGS_COLLECTION } from '@respond/shared/types/data/organizationDoc';
import { Location } from '@respond/shared/types/location';
import { Organization } from '@respond/shared/types/organization';
import type UserAuth from '@respond/shared/types/userAuth';
import { produce } from 'immer';

import { produceEvents } from './commandHandlers';
import mongoPromise, { getRelatedOrgIds } from './mongodb';
import { defaultReactors, Reactor } from './reactors';

type DatabaseActivity = Activity & { removeTime?: number };

export interface ActionListener {
  broadcastEvent(events: StampedEvent[], toRooms: string[] | undefined): void;
}

const LOCATION_COLLECTION_NAME = 'locations';

export class StateManager {
  private listeners: ActionListener[] = [];
  private activityState: ActivityState = { list: [] };
  private locationsState: LocationState = { list: [] };
  private organizationsState: OrganizationState = { list: [] };

  constructor(private readonly reactors: Reactor[] = defaultReactors) {}

  addClient(listener: ActionListener) {
    this.listeners = [...this.listeners, listener];
  }

  removeClient(listener: ActionListener) {
    this.listeners = this.listeners.filter((f) => f !== listener);
  }

  async start() {
    const mongo = await mongoPromise;
    const allActivities = await mongo.db().collection<DatabaseActivity>('activities').find().toArray();
    this.activityState = {
      list: allActivities.filter((a) => !a.removeTime),
    };
    const allLocations = await mongo.db().collection<Location>(LOCATION_COLLECTION_NAME).find().toArray();
    this.locationsState = {
      list: allLocations,
    };
    const allOrganizations = (await mongo.db().collection<Organization>(ORGS_COLLECTION).find().project({ id: 1, title: 1, rosterName: 1 }).toArray()) as Organization[];
    this.organizationsState = {
      list: allOrganizations,
    };
  }

  async getStateForUser(user: UserAuth) {
    console.log('getting state for ' + user.userId);

    const myOrgIds = await getRelatedOrgIds(user.organizationId);

    return {
      list: filterInitialActivities(this.activityState.list.filter((a) => myOrgIds.includes(a.ownerOrgId))),
    };
  }

  getLocationState() {
    return this.locationsState;
  }

  async getAllOrganizations() {
    return this.organizationsState.list;
  }

  async getAllActivities() {
    return this.activityState.list;
  }

  /**
   * Command/event pipeline (Phase 2). Validate a command into event(s), stamp
   * author + timestamp, reduce into memory, append to the `events` audit log,
   * persist the changed activity snapshot, broadcast the events, then run
   * reactors whose follow-up commands re-enter this same pipeline.
   */
  async handleCommand(command: Command, author: EventAuthor): Promise<void> {
    const events = produceEvents(command);
    if (!events.length) return;

    const stamped: StampedEvent[] = events.map((event) => ({ ...event, meta: { author, timestamp: Date.now() } }));

    // Append every event to the audit log (both domains).
    const mongo = await mongoPromise;
    await mongo
      .db()
      .collection('events')
      .insertMany(stamped.map((event) => ({ ...event, activityId: (event.payload as { activityId?: string }).activityId })));

    // A command is single-domain, but partition defensively: activity events
    // reduce into ActivityState (org-scoped broadcast + reactors); location
    // events reduce into LocationState (broadcast to all, no reactors).
    const locationEvents = stamped.filter((event) => isLocationEvent(event));
    const activityEvents = stamped.filter((event) => !isLocationEvent(event));

    if (activityEvents.length) {
      const priorActivities = this.snapshotActivities();
      this.activityState = produce(this.activityState, (draft) => {
        for (const event of activityEvents) {
          BasicEventReducers[event.type as keyof typeof BasicEventReducers](draft, event as never);
        }
      });

      const rooms = await this.persistActivityChanges(priorActivities, false);
      for (const listener of this.listeners) {
        listener.broadcastEvent(activityEvents, rooms);
      }

      // Reactors observe activity events; follow-up commands re-enter the
      // pipeline authored as the reactor (a service).
      const ctx = { priorActivities, currentActivities: this.snapshotActivities() };
      for (const event of activityEvents) {
        for (const reactor of this.reactors) {
          for (const followup of await reactor.react(event, ctx)) {
            await this.handleCommand(followup, serviceAuthor(reactor.name));
          }
        }
      }
    }

    if (locationEvents.length) {
      const priorLocations = this.snapshotLocations();
      this.locationsState = produce(this.locationsState, (draft) => {
        for (const event of locationEvents) {
          BasicLocationEventReducers[event.type as keyof typeof BasicLocationEventReducers](draft, event as never);
        }
      });

      await this.persistLocationChanges(priorLocations);
      for (const listener of this.listeners) {
        listener.broadcastEvent(locationEvents, undefined); // locations are broadcast to all clients
      }
    }
  }

  /**
   * Diff the current in-memory activities against a pre-reduce snapshot, persist
   * every changed/removed activity to Mongo (soft-delete via `removeTime`), and
   * return the `org:<id>` rooms that should receive the resulting broadcast.
   * Shared by the legacy action path and the new command/event pipeline.
   */
  private async persistActivityChanges(oldActivities: Record<string, Activity>, isSummaryLevelUpdate: boolean): Promise<string[]> {
    const mongo = await mongoPromise;
    const affectedOrgs = new Set<string>();
    const currentActivities: Record<string, Activity> = this.activityState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});
    for (const updatedId of Object.keys(currentActivities).filter((k) => oldActivities[k] !== currentActivities[k])) {
      console.log('MONGO update activity', updatedId);

      (await this.getOrgsInterestedInAction(isSummaryLevelUpdate, oldActivities[updatedId])).forEach((o) => affectedOrgs.add(o));
      (await this.getOrgsInterestedInAction(isSummaryLevelUpdate, currentActivities[updatedId])).forEach((o) => affectedOrgs.add(o));

      await mongo.db().collection<Activity>('activities').replaceOne({ id: updatedId }, currentActivities[updatedId], {
        upsert: true,
      });
    }

    for (const removedId of Object.keys(oldActivities).filter((k) => currentActivities[k] == undefined)) {
      console.log('MONGO remove activity', removedId);
      (await this.getOrgsInterestedInAction(true, oldActivities[removedId])).forEach((o) => affectedOrgs.add(o));

      // Instead of deleting from the database, only stamp the activity as having been removed.
      // Our in-memory state will no longer have the activity, but the data isn't gone.
      const activityWithRemoveTime = {
        ...oldActivities[removedId],
        removeTime: new Date().getTime(),
      };

      await mongo.db().collection<DatabaseActivity>('activities').replaceOne({ id: removedId }, activityWithRemoveTime, {
        upsert: true,
      });
    }

    return Array.from(affectedOrgs).map((o) => `org:${o}`);
  }

  private snapshotActivities(): Record<string, Activity> {
    return this.activityState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});
  }

  private snapshotLocations(): Record<string, Location> {
    return this.locationsState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});
  }

  /**
   * Diff the current locations against a pre-reduce snapshot and persist changed
   * (upsert) / removed (delete) locations to Mongo. Shared by the legacy action
   * path and the command/event pipeline.
   */
  private async persistLocationChanges(oldLocations: Record<string, Location>): Promise<void> {
    const mongo = await mongoPromise;
    const currentLocations = this.snapshotLocations();
    for (const updatedId of Object.keys(currentLocations).filter((k) => oldLocations[k] !== currentLocations[k])) {
      console.log('MONGO update location', updatedId);
      await mongo.db().collection<Location>(LOCATION_COLLECTION_NAME).replaceOne({ id: updatedId }, currentLocations[updatedId], {
        upsert: true,
      });
    }

    for (const removedId of Object.keys(oldLocations).filter((k) => currentLocations[k] == undefined)) {
      console.log('MONGO remove location', removedId);
      await mongo.db().collection<Location>(LOCATION_COLLECTION_NAME).deleteOne({ id: removedId });
    }
  }

  private async getOrgsInterestedInAction(summaryLevelUpdate: boolean, activity?: Activity): Promise<string[]> {
    if (!activity) {
      return [];
    }

    const participatingOrgs = Object.values(activity.organizations ?? {}).map((o) => o.id);
    const interestedIds = Array.from(new Set([/*...partnerOrgs,*/ ...participatingOrgs]));
    return interestedIds;
  }
}
