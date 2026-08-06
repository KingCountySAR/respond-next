import type { Action } from '@reduxjs/toolkit';
import { produce } from 'immer';

import mongoPromise, { getRelatedOrgIds } from './mongodb';
import type { ActivityState, LocationState, OrganizationState } from '@respond/shared';
import { BasicActivityReducers, BasicEventReducers, BasicLocationReducers } from '@respond/shared';
import { Command } from '@respond/shared/commands';
import { EventAuthor, serviceAuthor, StampedEvent } from '@respond/shared/events';
import type { Activity } from '@respond/shared/types/activity';
import { ORGS_COLLECTION } from '@respond/shared/types/data/organizationDoc';
import { Location } from '@respond/shared/types/location';
import { Organization } from '@respond/shared/types/organization';
import type UserAuth from '@respond/shared/types/userAuth';

import { ActivityAction, isActivityAction } from '@respond/shared/state/activityActions';
import { filterInitialActivities } from '@respond/shared/state/activityVisibility';
import { isLocationAction, LocationAction } from '@respond/shared/state/locationActions';

import { produceEvents } from './commandHandlers';
import { defaultReactors, Reactor } from './reactors';

type DatabaseActivity = Activity & { removeTime?: number };

export interface ActionListener {
  broadcastAction(action: Action, toRooms: string[] | undefined, reporterId: string): void;
  broadcastEvent(events: StampedEvent[], toRooms: string[] | undefined): void;
}

const LOCATION_COLLECTION_NAME = 'locations';
const ALL_ROOMS_TAG = '3496260fa6f74124a7b7abae014a4f67';

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

  async handleIncomingAction(action: Action, reporterId: string, auth: { userId: string; email: string }) {
    const toRooms: Record<string, boolean> = {};

    console.log('handleIncomingAction', reporterId, JSON.stringify(auth));
    if (isActivityAction(action)) {
      (await this.handleActivityAction(action, auth)).reduce((accum, cur) => ({ ...accum, [cur]: true }), toRooms);
    }

    if (isLocationAction(action)) {
      (await this.handleLocationAction(action, auth)).reduce((accum, cur) => ({ ...accum, [cur]: true }), toRooms);
    }

    if (isSyncAction(action)) {
      action.meta.sync = false;
    }

    for (const listener of this.listeners) {
      listener.broadcastAction(action, toRooms[ALL_ROOMS_TAG] ? undefined : Object.keys(toRooms), reporterId);
    }
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

    const priorActivities = this.snapshotActivities();
    const stamped: StampedEvent[] = events.map((event) => ({ ...event, meta: { author, timestamp: Date.now() } }));

    this.activityState = produce(this.activityState, (draft) => {
      for (const event of stamped) {
        BasicEventReducers[event.type as keyof typeof BasicEventReducers](draft, event as never);
      }
    });

    const mongo = await mongoPromise;
    await mongo
      .db()
      .collection('events')
      .insertMany(stamped.map((event) => ({ ...event, activityId: (event.payload as { activityId: string }).activityId })));

    const rooms = await this.persistActivityChanges(priorActivities, false);

    for (const listener of this.listeners) {
      listener.broadcastEvent(stamped, rooms);
    }

    // Reactors run after the events are authoritative. Their follow-up commands
    // re-enter the pipeline authored as the reactor (a service), each producing
    // its own broadcast. Terminates because no reactor observes the events its
    // own follow-up commands produce.
    const ctx = { priorActivities, currentActivities: this.snapshotActivities() };
    for (const event of stamped) {
      for (const reactor of this.reactors) {
        for (const followup of await reactor.react(event, ctx)) {
          await this.handleCommand(followup, serviceAuthor(reactor.name));
        }
      }
    }
  }

  private async handleActivityAction(action: ActivityAction, auth: { userId: string; email: string }) {
    // If everything checks out, play the action into our store.

    const oldActivities = this.snapshotActivities();

    const nextState = produce(this.activityState, (draft) => {
      BasicActivityReducers[action.type](draft, action as never);
    });

    // TODO: Validate nextState
    this.activityState = nextState;

    const mongo = await mongoPromise;

    await mongo.db().collection('history').insertOne({
      action: action,
      time: new Date(),
      userId: auth.userId,
      email: auth.email,
    });

    return this.persistActivityChanges(oldActivities, action.type === 'activity/update');
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

  private async handleLocationAction(action: LocationAction, auth: { userId: string; email: string }) {
    console.log('stateManager reportAction', action);

    const oldLocations: Record<string, Location> = this.locationsState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});

    const nextState = produce(this.locationsState, (draft) => {
      BasicLocationReducers[action.type](draft, action as never);
    });
    this.locationsState = nextState;

    const mongo = await mongoPromise;

    await mongo.db().collection('history').insertOne({
      action: action,
      time: new Date(),
      userId: auth.userId,
      email: auth.email,
    });

    const currentLocations: Record<string, Location> = this.locationsState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});
    for (const updatedId of Object.keys(currentLocations).filter((k) => oldLocations[k] !== currentLocations[k])) {
      console.log('MONGO update location', updatedId);
      //if (!currentLocations[updatedId].isSaved) continue;
      await mongo.db().collection<Location>(LOCATION_COLLECTION_NAME).replaceOne({ id: updatedId }, currentLocations[updatedId], {
        upsert: true,
      });
    }

    for (const removedId of Object.keys(oldLocations).filter((k) => currentLocations[k] == undefined)) {
      console.log('MONGO remove location', removedId);
      await mongo.db().collection<Location>(LOCATION_COLLECTION_NAME).deleteOne({ id: removedId });
    }

    return [ALL_ROOMS_TAG];
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

function isSyncAction(object: object): object is { meta: { sync: boolean } } {
  if ('meta' in object) {
    if ('sync' in (object as { meta: object }).meta) {
      return true;
    }
  }
  return false;
}
