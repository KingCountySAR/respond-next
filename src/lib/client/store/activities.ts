import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import { Activity, ResponderStatus } from '@respond/types/activity';
import { AppStartListening, RootState } from '.';
import { ActivityState, ActivityActions, BasicReducers } from '@respond/lib/state';

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

// export function addListeners(listenTo: AppStartListening) {
//   listenTo({
//     matcher: isAnyOf(ActivityActions.reload),
//     effect: (action) => {
//       console.log('listener side effect. ', action.type, action.payload);
//     },
//   });
// };