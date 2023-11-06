import produce from 'immer';

import mongoPromise, { getRelatedOrgIds } from '@respond/lib/server/mongodb';
import type { ActivityAction, ActivityState } from '@respond/lib/state';
import { BasicReducers } from '@respond/lib/state';
import type { Activity } from '@respond/types/activity';
import { OrganizationDoc, ORGS_COLLECTION } from '@respond/types/data/organizationDoc';
import type UserAuth from '@respond/types/userAuth';

import { ActivityActions, ParticipantUpdateAction } from '../state/activityActions';

import { getServices } from './services';

export interface ActionListener {
  broadcastAction(action: ActivityAction, toRooms: string[], reporterId: string): void;
}

export class StateManager {
  private listeners: ActionListener[] = [];
  private activityState: ActivityState = { list: [] };

  addClient(listener: ActionListener) {
    this.listeners = [...this.listeners, listener];
  }

  removeClient(listener: ActionListener) {
    this.listeners = this.listeners.filter((f) => f !== listener);
  }

  async start() {
    const mongo = await mongoPromise;
    this.activityState = {
      list: await mongo.db().collection<Activity>('activities').find().toArray(),
    };
  }

  async getStateForUser(user: UserAuth) {
    console.log('getting state for ' + user.userId);

    const myOrgIds = await getRelatedOrgIds(user.organizationId);

    return {
      list: this.activityState.list.filter((a) => myOrgIds.includes(a.ownerOrgId)),
    };
  }

  async getAllActivities() {
    return this.activityState.list;
  }

  async handleIncomingAction(action: ActivityAction, reporterId: string, auth: { userId: string; email: string }) {
    console.log('stateManager reportAction', action);

    // If everything checks out, play the action into our store.

    const oldActivities: Record<string, Activity> = this.activityState.list.reduce((accum, cur) => ({ ...accum, [cur.id]: cur }), {});

    const nextState = produce(this.activityState, (draft) => {
      console.log('reducing ', action.type, action.payload);
      BasicReducers[action.type](draft, action as any);
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
      await mongo.db().collection<Activity>('activities').deleteOne({ id: removedId });
    }

    action.meta.sync = false;

    const toRooms = Array.from(affectedOrgs).map((o) => `org:${o}`);
    for (const listener of this.listeners) {
      listener.broadcastAction(action, toRooms, reporterId);
    }
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
