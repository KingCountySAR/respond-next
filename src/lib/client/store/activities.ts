import { createSlice } from '@reduxjs/toolkit';
import { Activity, Participant, ResponderStatus, ResponderUpdate } from '@respond/types/activity';
import { RootState } from '.';
import { ActivityState, ActivityActions, BasicReducers } from '@respond/lib/state';
import { isActive as isResponderStatusActive } from '@respond/types/activity';

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
  return Object.values(activity.participants).filter(p => isResponderStatusActive(p.timeline[0].status) == true);
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
      if (myUpdate && myUpdate.status !== ResponderStatus.NotResponding) {
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

/**
 * @description Members can sign in prior to the start time of a future mission.
 * @return 4 Hours in milliseconds.
 */
export const earlySigninWindow = 4 * 60 * 60 * 1000;

export function isFuture(time: number) {
  return time > new Date().getTime();
};

export function isPending(a: Activity) {
  return isActive(a) && !isOpen(a);
}

export function isOpen(a: Activity) {
  return isActive(a) && !isFuture(a.startTime - earlySigninWindow);
}

export function isStarted(a: Activity) {
  return isActive(a) && !isFuture(a.startTime);
}

export function isActive(a: Activity) {
  return !isComplete(a);
}

export function isComplete(a: Activity) {
  return !!a.endTime;
}

export function getActivityStatus(a: Activity) {
  if (isComplete(a)) { return 'Closed' }
  if (isStarted(a)) { return 'In Progress' }
  if (isOpen(a)) { return 'Open For Sign In' }
  if (isPending(a)) { return 'Not Started' }
}

export function getActivityPath(activity: Activity) {
  return `/${activity.isMission ? 'mission' : 'event'}/${activity.id}`
}
