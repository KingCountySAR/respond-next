import { createAction } from '@reduxjs/toolkit';
import { Activity, OrganizationStatus, pickActivityProperties, ResponderStatus } from '@respond/types/activity';
import { ActivityState } from '.';

const reload = createAction('activities/load', (state: ActivityState) => ({
  payload: state,
  meta: { sync: false },
}));

const update = createAction('activity/update', (updates: Partial<Activity> & { id: string }) => ({
  payload: pickActivityProperties(updates),
  meta: { sync: true },
}));

const remove = createAction('activity/remove', (activityId: string) => ({
  payload: { id: activityId },
  meta: { sync: true },
}))

const appendOrganizationTimeline = createAction('participatingOrg/append', (
  activityId: string,
  org: { id: string, title: string, rosterName?: string },
  status: { time: number, status: OrganizationStatus }
) => ({
  payload: { activityId, orgId: org.id, org, status },
  meta: { sync: true },
}));

const participantUpdate = createAction('participant/update', (activityId: string, id: string, firstname: string, lastname: string, organizationId: string, time: number, status: ResponderStatus) => ({
  payload: {
    activityId,
    participant: {
      id,
      firstname,
      lastname,
      organizationId,
    },
    update: {
      time,
      status,
    }
  },
  meta: { sync: true },
}))

export const ActivityActions = {
  reload,
  update,
  remove,
  appendOrganizationTimeline,
  participantUpdate,
};

export type ActivityActionsType = typeof ActivityActions;
type AllActivityActions = { [K in keyof ActivityActionsType]: ReturnType<ActivityActionsType[K]>};
export type ActivityAction = AllActivityActions[keyof AllActivityActions];