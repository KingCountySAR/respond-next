import type { Draft } from '@reduxjs/toolkit';
import merge from 'lodash.merge';

import type { ActivityState } from '..';
import { Activity, createNewActivity, OrganizationStatus, ParticipantStatus, pickActivityProperties } from '../types/activity';
import { OperationsSpecificFields } from '../types/operations';

import { defineEvent } from './defineEvent';
import { participantUpdate } from './participantEvents';

// Activity summary + lifecycle facts.

export type ActivityIdPayload = { activityId: string };

export const ActivityEvents = {
  ActivityUpdated: defineEvent(
    //
    'evt/activity/updated',
    (state: Draft<ActivityState>, { updates }: { updates: Partial<Activity> & { id: string } }) => {
      let target = state.list.find((a) => a.id === updates.id);
      if (!target) {
        target = createNewActivity();
        state.list.push(target);
      }
      merge(target, pickActivityProperties(updates));
    },
  ),

  ActivityRemoved: defineEvent(
    //
    'evt/activity/removed',
    (state: Draft<ActivityState>, { activityId }: ActivityIdPayload) => {
      state.list = state.list.filter((f) => f.id !== activityId);
    },
  ),

  ActivityCompleted: defineEvent(
    //
    'evt/activity/completed',
    (state: Draft<ActivityState>, { activityId, endTime }: { activityId: string; endTime: number }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      activity.endTime = endTime;
      // Sign every participant out at the end time.
      for (const pId in activity.participants) {
        const participant = activity.participants[pId];
        participantUpdate(state, {
          payload: {
            activityId: activity.id,
            participant: {
              id: participant.id,
              firstname: participant.firstname,
              lastname: participant.lastname,
              organizationId: participant.organizationId,
              miles: participant.miles,
              eta: participant.eta,
            },
            update: { time: endTime, status: ParticipantStatus.SignedOut },
          },
        });
      }
    },
  ),

  ActivityReactivated: defineEvent(
    //
    'evt/activity/reactivated',
    (state: Draft<ActivityState>, { activityId }: ActivityIdPayload) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (activity) activity.endTime = undefined;
    },
  ),

  OrganizationTimelineAppended: defineEvent(
    //
    'evt/activity/orgAppended',
    (
      state: Draft<ActivityState>,
      { activityId, orgId, org, status }: { activityId: string; orgId: string; org: { id: string; title: string; rosterName?: string }; status: { time: number; status: OrganizationStatus } },
    ) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      activity.organizations[orgId] = Object.assign(activity.organizations[orgId] ?? { timeline: [] }, org);
      activity.organizations[orgId].timeline.unshift(status);
    },
  ),

  // The server has stamped the default operations state onto an activity. The
  // payload carries the fully-built operations (server-minted place ids) so every
  // client applies identical state.
  OperationsDecorated: defineEvent(
    //
    'evt/activity/operationsDecorated',
    (state: Draft<ActivityState>, { activityId, operations }: { activityId: string; operations: OperationsSpecificFields }) => {
      const activity = state.list.find((a) => a.id === activityId);
      if (!activity) return;
      if (!activity.teams) activity.teams = operations.teams;
      if (!activity.comms) activity.comms = operations.comms;
      if (!activity.staff) activity.staff = operations.staff;
      if (!activity.places) activity.places = operations.places;
    },
  ),
};
