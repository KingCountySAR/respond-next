import { produce } from 'immer';

import { Command } from '@shared/commands';
import { EventAuthor, isLocationEvent, serviceAuthor, StampedEvent } from '@shared/events';
import { BasicEventReducers, BasicLocationReducers } from '@shared/state';
import type { ActivityState, LocationState, OrganizationState } from '@shared/state';
import { filterInitialActivities } from '@shared/state/activityVisibility';
import type { Activity } from '@shared/types/activity';
import { ORGS_COLLECTION } from '@shared/types/data/organizationDoc';
import { Location } from '@shared/types/location';
import { Organization } from '@shared/types/organization';
import type UserAuth from '@shared/types/userAuth';

import { produceEvents } from './commandHandlers';
import mongoPromise, { getRelatedOrgIds } from './mongodb';
import { defaultReactors, Reactor } from './reactors';

type DatabaseActivity = Activity & { removeTime?: number };

export interface ActionListener {
  broadcastEvent(events: StampedEvent[], toRooms: string[] | undefined): void;
}

const LOCATION_COLLECTION_NAME = 'locations';

function isPromise<T>(value: T[] | Promise<T[]>): value is Promise<T[]> {
  return typeof (value as Promise<T[]>)?.then === 'function';
}

export class StateManager {
  private listeners: ActionListener[] = [];
  private activityState: ActivityState = { list: [] };
  private locationsState: LocationState = { list: [] };
  private organizationsState: OrganizationState = { list: [] };
  /**
   * In-flight fire-and-forget async-reactor chains. Production never awaits
   * these (that's the point — they're deferred); tests call `settle()` to wait
   * for them before asserting on the resulting state.
   */
  private pendingReactions = new Set<Promise<void>>();
  /**
   * Serializes handleCommand: each call snapshots `this.activityState`/
   * `this.locationsState` before its own awaits and writes back after them, so
   * two concurrent calls (e.g. a client firing several commands back-to-back)
   * would otherwise race — a later-starting-but-earlier-finishing call can
   * clobber the other's in-memory update with a stale snapshot (Mongo stays
   * correct since each call's own persist step runs synchronously off its own
   * commit; only the in-memory copy gets corrupted). Chaining every call onto
   * this queue guarantees full serialization.
   */
  private queue: Promise<unknown> = Promise.resolve();

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
   * persist the changed snapshot, and broadcast — all as a single atomic batch.
   *
   * A command and its *synchronous* reactors collapse into one transaction: the
   * command's events plus every sync reactor's follow-up events are folded into a
   * single `insertMany` / persist / broadcast, so the client applies them in one
   * render (no per-reactor Mongo round-trip flicker). *Asynchronous* reactors
   * (those returning a promise, e.g. a member-provider tag lookup) are deferred:
   * they run fire-and-forget after the commit and their follow-up commands
   * re-enter this pipeline as a later, separate broadcast.
   */
  async handleCommand(command: Command, author: EventAuthor): Promise<void> {
    const run = this.queue.then(() => this.processCommand(command, author));
    // Keep the queue alive even if this command throws, so later-queued
    // commands still run; the rejection itself still propagates to this caller.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async processCommand(command: Command, author: EventAuthor): Promise<void> {
    const events = produceEvents(command);
    if (!events.length) return;

    // A command is single-domain. Location events reduce into LocationState
    // (broadcast to all, no reactors); everything else is an activity command.
    if (events.every((event) => isLocationEvent(event))) {
      await this.handleLocationEvents(events.map((event) => this.stamp(event, author)));
      return;
    }

    const mongo = await mongoPromise;
    const priorActivities = this.snapshotActivities();
    let workingState = this.activityState;
    const batch: StampedEvent[] = [];
    // FIFO work-list, seeded with the command's already-produced events. Sync
    // reactors append their follow-up events here; the loop drains it so a sync
    // reactor's event can itself trigger further sync reactors.
    const pending: StampedEvent[] = events.map((event) => this.stamp(event, author));
    // Async reactors: captured here (name + in-flight promise) and drained after
    // the commit so their slow work never blocks the batch.
    const deferred: { name: string; result: Promise<Command[]> }[] = [];

    while (pending.length) {
      if (batch.length > 5000) throw new Error('reactor fold exceeded 5000 events — likely a self-triggering reactor');
      const event = pending.shift()!;
      workingState = produce(workingState, (draft) => {
        BasicEventReducers[event.type as keyof typeof BasicEventReducers](draft, event as never);
      });
      batch.push(event);

      const ctx = { priorActivities, currentActivities: this.snapshotOf(workingState) };
      for (const reactor of this.reactors) {
        const reaction = reactor.react(event, ctx);
        if (isPromise(reaction)) {
          // Async reactor — defer; it read `ctx` synchronously up to its first
          // await, so it sees the correct state at this event.
          deferred.push({ name: reactor.name, result: reaction });
        } else {
          // Sync reactor — fold its follow-up events into this same batch.
          const followupAuthor = serviceAuthor(reactor.name);
          for (const followup of reaction) {
            for (const followupEvent of produceEvents(followup)) {
              pending.push(this.stamp(followupEvent, followupAuthor));
            }
          }
        }
      }
    }

    // Commit the whole batch once: audit log, in-memory state, Mongo, broadcast.
    await mongo
      .db()
      .collection('events')
      .insertMany(batch.map((event) => ({ ...event, activityId: (event.payload as { activityId?: string }).activityId })));
    this.activityState = workingState;
    const rooms = await this.persistActivityChanges(priorActivities, false);
    for (const listener of this.listeners) {
      listener.broadcastEvent(batch, rooms);
    }

    // Fire-and-forget the deferred async reactors: their follow-up commands
    // re-enter this pipeline as their own (later) atomic batch.
    for (const { name, result } of deferred) {
      const chain = result
        .then((followups) => Promise.all(followups.map((followup) => this.handleCommand(followup, serviceAuthor(name)))))
        .then(() => undefined)
        .catch((err) => console.error(`async reactor ${name} failed`, err));
      this.pendingReactions.add(chain);
      chain.finally(() => this.pendingReactions.delete(chain));
    }
  }

  /**
   * Test support: await all in-flight fire-and-forget async-reactor chains.
   * Loops because a deferred command can spawn further deferred work. Not used
   * in production (the whole point of async reactors is that nothing awaits them).
   */
  async settle(): Promise<void> {
    while (this.pendingReactions.size) {
      await Promise.all(this.pendingReactions);
    }
  }

  private stamp(event: ReturnType<typeof produceEvents>[number], author: EventAuthor): StampedEvent {
    return { ...event, meta: { author, timestamp: Date.now() } };
  }

  /** Reduce + persist + broadcast location events (broadcast to all clients, no reactors). */
  private async handleLocationEvents(events: StampedEvent[]): Promise<void> {
    const mongo = await mongoPromise;
    await mongo
      .db()
      .collection('events')
      .insertMany(events.map((event) => ({ ...event, activityId: (event.payload as { activityId?: string }).activityId })));

    const priorLocations = this.snapshotLocations();
    this.locationsState = produce(this.locationsState, (draft) => {
      for (const event of events) {
        BasicLocationReducers[event.type as keyof typeof BasicLocationReducers](draft, event as never);
      }
    });

    await this.persistLocationChanges(priorLocations);
    for (const listener of this.listeners) {
      listener.broadcastEvent(events, undefined);
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
    return this.snapshotOf(this.activityState);
  }

  private snapshotOf(state: ActivityState): Record<string, Activity> {
    return state.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});
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
