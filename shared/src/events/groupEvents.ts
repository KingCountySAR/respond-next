import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
import { AssignmentTarget, Group } from '../types/operations';

import { defineEvent } from './defineEvent';

// Facts about groups, minted by the server and broadcast to all clients.

export type GroupPayload = { activityId: string; group: Group };

export const GroupEvents = {
  GroupCreated: defineEvent(
    //
    'evt/group/created',
    (state: Draft<ActivityState>, { activityId, group }: GroupPayload) => {
      const activity = state.list.find((a) => a.id === activityId);
      if (!activity) return;
      activity.groups = [...(activity.groups ?? []), group];
    },
  ),

  GroupUpdated: defineEvent(
    //
    'evt/group/updated',
    (state: Draft<ActivityState>, { activityId, group }: GroupPayload) => {
      const activity = state.list.find((a) => a.id === activityId);
      if (!activity) return;
      activity.groups = (activity.groups ?? []).map((p) => (p.id === group.id ? group : p));
    },
  ),

  // `target` is threaded through but not consumed here — reassigning the
  // group's participants/equipment happens via the group-deleted reactor
  // emitting ResourceCommands.
  GroupDeleted: defineEvent(
    //
    'evt/group/deleted',
    (state: Draft<ActivityState>, { activityId, id }: { activityId: string; id: string; target: AssignmentTarget }) => {
      const activity = state.list.find((a) => a.id === activityId);
      if (!activity) return;
      activity.groups = (activity.groups ?? []).filter((p) => p.id !== id);
    },
  ),
};
