import { Action } from '@reduxjs/toolkit';
import produce from 'immer';

import mongoPromise, { getRelatedOrgIds } from '@respond/lib/server/mongodb';
import type { ActivityState, LocationState } from '@respond/lib/state';
import { BasicActivityReducers, BasicLocationReducers } from '@respond/lib/state';
import type { Activity } from '@respond/types/activity';
import { OrganizationDoc, ORGS_COLLECTION } from '@respond/types/data/organizationDoc';
import { Location } from '@respond/types/location';
import type UserAuth from '@respond/types/userAuth';

import { ActivityAction, ActivityActions, isActivityAction, ParticipantUpdateAction } from '../state/activityActions';
import { isLocationAction, LocationAction } from '../state/locationActions';

import { getServices } from './services';

type DatabaseActivity = Activity & { removeTime?: number };

export interface ActionListener {
  broadcastAction(action: Action, toRooms: string[] | undefined, reporterId: string): void;
}

const LOCATION_COLLECTION_NAME = 'locations';
const ALL_ROOMS_TAG = '3496260fa6f74124a7b7abae014a4f67';

export class StateManager {
  private listeners: ActionListener[] = [];
  private activityState: ActivityState = { list: [] };
  private locationsState: LocationState = { list: [] };

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
  }

  async getStateForUser(user: UserAuth) {
    console.log('getting state for ' + user.userId);

    const myOrgIds = await getRelatedOrgIds(user.organizationId);

    return {
      list: this.activityState.list.filter((a) => myOrgIds.includes(a.ownerOrgId)),
    };
  }

  getLocationState() {
    return this.locationsState;
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

    for (const listener of this.listeners) {
      listener.broadcastAction(action, toRooms[ALL_ROOMS_TAG] ? undefined : Object.keys(toRooms), reporterId);
    }
  }

  private async handleActivityAction(action: ActivityAction, auth: { userId: string; email: string }) {
    // If everything checks out, play the action into our store.

    const oldActivities: Record<string, Activity> = this.activityState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});

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

    if (action.type == 'participant/update') {
      this.loadTagsIfNewParticipant(action);
    }

    const affectedOrgs = new Set<string>();
    const currentActivities: Record<string, Activity> = this.activityState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});
    for (const updatedId of Object.keys(currentActivities).filter((k) => oldActivities[k] !== currentActivities[k])) {
      console.log('MONGO update activity', updatedId);
      const isSummaryLevelUpdate = action.type === 'activity/update';

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

    action.meta.sync = false;

    const toRooms = Array.from(affectedOrgs).map((o) => `org:${o}`);
    return toRooms;
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

  private async loadTagsIfNewParticipant(action: ParticipantUpdateAction) {
    const activity = this.activityState.list.find((f) => f.id === action.payload.activityId);
    const isNew = activity?.participants[action.payload.participant.id].tags === undefined;
    if (!isNew) {
      return;
    }

    let orgTags: string[] = [];
    const doAction = () => this.handleIncomingAction(ActivityActions.tagParticipant(action.payload.activityId, action.payload.participant.id, orgTags), 'SYSTEM', { email: 'SYSTEM', userId: 'SYSTEM' });

    const mongo = await mongoPromise;
    const organization = await mongo.db().collection<OrganizationDoc>(ORGS_COLLECTION).findOne({ id: action.payload.participant.organizationId });
    if (!organization) {
      await doAction();
      return;
    }

    const memberProvider = (await getServices()).memberProviders.get(organization?.memberProvider?.provider);
    if (!memberProvider) {
      await doAction();
      return;
    }

    const entry = await memberProvider.getMemberInfoById(action.payload.participant.id);
    if (!entry) {
      await doAction();
      return;
    }

    orgTags = organization.tags?.filter((f) => entry.groups.find((g) => g === f.groupId)).map((f) => f.label) ?? [];
    await doAction();
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
