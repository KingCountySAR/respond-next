import { createAction, createSlice } from '@reduxjs/toolkit';
import { Activity, createNewActivity, OrganizationStatus, ResponderStatus } from '@respond/types/activity';
import merge from 'lodash.merge';
import { RootState } from '.';

export interface ActivityState {
  list: Activity[];
}

let initialState: ActivityState = {
  list: [],
};

if (typeof localStorage !== 'undefined' && localStorage.activities) {
  initialState = JSON.parse(localStorage.activities);
}

console.log('activity initialstate', initialState);
const update = createAction('activity/update', (updates: Partial<Activity> & { id: string }) => ({
  payload: updates,
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

const activitiesSlice = createSlice({
  name: 'activities',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(update, (state, { payload }) => {
        let target = state.list.find(a => a.id === payload.id);
        if (!target) {
          target = createNewActivity();
          state.list.push(target);
        }
        merge(target, payload);
      })
      .addCase(remove, (state, { payload }) => {
        state.list = state.list.filter(f => f.id !== payload.id)
      })
      .addCase(appendOrganizationTimeline, (state, { payload }) => {
        const activity = state.list.find(f => f.id === payload.activityId);
        if (activity) {
          activity.organizations[payload.orgId] = Object.assign(activity.organizations[payload.orgId] ?? { timeline: [] }, payload.org);
          activity.organizations[payload.orgId].timeline.unshift(payload.status);
        }
      })
  },
});

export default activitiesSlice.reducer;

export const ActivityActions = {
  ...activitiesSlice.actions,
  update,
  remove,
  appendOrganizationTimeline,
}

export function buildActivityTypeSelector(missions: boolean) {
  return (state: RootState) => state.activities.list.filter(f => f.isMission === missions);
}

export function getActiveParticipants(a: Activity) {
  return Object.values(a.participants).filter(p => (p.timeline.slice(-1)?.[0].status ?? ResponderStatus.Unavailable) & 0x01);
}

export function buildActivitySelector(id?: string) {
  return (state: RootState) => id ? state.activities.list.find(a => a.id === id) : undefined;
}
