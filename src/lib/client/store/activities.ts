import { createSlice } from '@reduxjs/toolkit';
import { Activity, Participant, ResponderStatus, ResponderUpdate } from '@respond/types/activity';
import { RootState } from '.';
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
      .addCase(ActivityActions.reactivate, BasicReducers[ActivityActions.reactivate.type])
      .addCase(ActivityActions.complete, BasicReducers[ActivityActions.complete.type])
      .addCase(ActivityActions.appendOrganizationTimeline, BasicReducers[ActivityActions.appendOrganizationTimeline.type])
      .addCase(ActivityActions.participantUpdate, BasicReducers[ActivityActions.participantUpdate.type])
  },
});

export default activitiesSlice.reducer;

export function buildActivityTypeSelector(missions: boolean) {
  return (state: RootState) => state.activities.list.filter(f => f.isMission === missions);
}

export function getActiveParticipants(activity: Activity) {
  return filterParticipantsByStatus(Object.values(activity.participants), [ResponderStatus.SignedIn])
}

export function getSignedInCount(activity: Activity) {
  return filterParticipantsByStatus(Object.values(activity.participants), [ResponderStatus.SignedIn]).length;
}

export function getStandbyCount(activity: Activity) {
  return filterParticipantsByStatus(Object.values(activity.participants), [ResponderStatus.Standby]).length;
}

export function getSignedOutCount(activity: Activity) {
  return filterParticipantsByStatus(Object.values(activity.participants), [ResponderStatus.SignedOut]).length;
}

function filterParticipantsByStatus(participants: Participant[], statuses: ResponderStatus[]) {
  return participants.filter(participant => statuses.includes(participant.timeline[0].status));
}

export function buildActivitySelector(id?: string) {
  return (state: RootState) => id ? state.activities.list.find(a => a.id === id) : undefined;
}

export function buildMyActivitySelector() {
  return (state: RootState) => {
    const participantId = state.auth.userInfo?.participantId;
    if (!participantId) {
      return [];
    }

    const myParticipation: { activity: Activity, status: ResponderUpdate }[] = [];
    for (const activity of state.activities.list) {
      const myUpdate = activity.participants[participantId]?.timeline[0];
      if (myUpdate?.status === ResponderStatus.SignedIn || myUpdate?.status === ResponderStatus.Standby) {
        myParticipation.push({ activity, status: myUpdate });
      }
    }

    return myParticipation.sort((a, b) => {
      if (a.activity.isMission === b.activity.isMission) {
        return (a.activity.startTime > b.activity.startTime) ? 1 : -1;
      }
      return a.activity.isMission ? 1 : -1;
    });
  }
}

export function isActive(a: Activity) {
  return !isComplete(a);
}

export function isComplete(a: Activity) {
  return !!a.endTime;
}

export function getActivityPath(activity: Activity) {
  return `/${activity.isMission ? 'mission' : 'event'}/${activity.id}`
}
