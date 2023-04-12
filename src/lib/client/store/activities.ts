import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import { Activity, ResponderStatus, ResponderUpdate } from '@respond/types/activity';
import { AppStartListening, RootState } from '.';
import { ActivityState, ActivityActions, BasicReducers } from '@respond/lib/state';
import { UserInfo } from '@respond/types/userInfo';

let initialState: ActivityState = {
  list: [],
};

if (typeof localStorage !== 'undefined' && localStorage.activities) {
  initialState = JSON.parse(localStorage.activities);
}

const activitiesSlice = createSlice({
  name: 'activities',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(ActivityActions.reload, BasicReducers[ActivityActions.reload.type])
      .addCase(ActivityActions.update, BasicReducers[ActivityActions.update.type])
      .addCase(ActivityActions.remove, BasicReducers[ActivityActions.remove.type])
      .addCase(ActivityActions.appendOrganizationTimeline, BasicReducers[ActivityActions.appendOrganizationTimeline.type])
  },
});

export default activitiesSlice.reducer;

export function buildActivityTypeSelector(missions: boolean) {
  return (state: RootState) => state.activities.list.filter(f => f.isMission === missions);
}

export function getActiveParticipants(a: Activity) {
  return Object.values(a.participants).filter(p => (p.timeline.slice(-1)?.[0].status ?? ResponderStatus.Unavailable) & 0x01);
}

export function buildActivitySelector(id?: string) {
  return (state: RootState) => id ? state.activities.list.find(a => a.id === id) : undefined;
}

export function buildMyActivitySelector() {
  return (state: RootState) => {
    const userId = state.auth.userInfo?.userId;
    if (!userId) {
      return [];
    }

    const myParticipation: { activity: Activity, status: ResponderUpdate }[] = [];
    for (const activity of state.activities.list) {
      const myUpdate = activity.participants[userId]?.timeline[0];
      if (myUpdate) myParticipation.push({ activity, status: myUpdate });
    }

    return myParticipation.sort((a, b) => {
      if (a.activity.isMission === b.activity.isMission) {
        return (a.activity.startTime > b.activity.startTime) ? 1 : -1;
      }
      return a.activity.isMission ? 1 : -1;
    });
  }
}