import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
import { AssignmentTarget, pickTeamProperties, Team } from '../types/operations';

import { defineEvent } from './defineEvent';

// Facts about teams + staff assignments, minted by the server.
// Participant/equipment assignment moved to resourceEvents.ts (Resource domain),
// since a target can now be a team, place, or group.

export type TeamTargetPayload = { activityId: string; id: string; target: AssignmentTarget };

export const TeamEvents = {
  TeamCreated: defineEvent(
    //
    'evt/team/created',
    (state: Draft<ActivityState>, { activityId, team }: { activityId: string; team: Team }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      activity.teams = activity.teams ?? [];
      activity.teams.push(team);
    },
  ),

  TeamUpdated: defineEvent(
    //
    'evt/team/updated',
    (state: Draft<ActivityState>, { activityId, updates }: { activityId: string; updates: Partial<Team> & { id: string } }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity || !activity.teams) return;
      const team = activity.teams.find((t) => t.id === updates.id);
      if (!team) return;
      Object.assign(team, pickTeamProperties(updates));
    },
  ),

  TeamDisbanded: defineEvent(
    //
    'evt/team/disbanded',
    (state: Draft<ActivityState>, { activityId, id }: TeamTargetPayload) => {
      const team = state.list.find((f) => f.id === activityId)?.teams?.find((t) => t.id === id);
      if (!team) return;
      team.status = 'Disbanded';
    },
  ),

  TeamDeleted: defineEvent(
    //
    'evt/team/deleted',
    (state: Draft<ActivityState>, { activityId, id }: TeamTargetPayload) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      activity.teams = (activity.teams ?? []).filter((t) => t.id !== id);
    },
  ),

  StaffUpdated: defineEvent(
    //
    'evt/team/staffUpdated',
    (state: Draft<ActivityState>, { activityId, staff }: { activityId: string; staff: Record<string, string> }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      activity.staff = {
        ...(activity.staff ?? {}),
        ...staff,
      };
    },
  ),
};
