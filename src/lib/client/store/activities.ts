import { CaseReducer, createSlice } from '@reduxjs/toolkit';
import { TypedActionCreator } from '@reduxjs/toolkit/dist/mapBuilders';
import { hoursToMilliseconds } from 'date-fns';

import { ActivityActions, ActivityState, BasicReducers } from '@respond/lib/state';
import { Activity, isActive as isParticipantStatusActive, ParticipantStatus, ParticipantUpdate } from '@respond/types/activity';

import { RootState } from '.';

export interface ReducerBuilderStub {
  addCase<ActionCreator extends TypedActionCreator<string>>(actionCreator: ActionCreator, reducer: CaseReducer<ActivityState, ReturnType<ActionCreator>>): ReducerBuilderStub;
}

let initialState: ActivityState = {
  list: [],
};

if (typeof localStorage !== 'undefined' && localStorage.activities) {
  initialState = JSON.parse(localStorage.activities);
}

const activitySliceArgs = {
  name: 'activities',
  initialState,
  reducers: {},
  extraReducers: (builder: ReducerBuilderStub) => {
    builder //
      .addCase(ActivityActions.reload, BasicReducers[ActivityActions.reload.type])
      .addCase(ActivityActions.update, BasicReducers[ActivityActions.update.type])
      .addCase(ActivityActions.remove, BasicReducers[ActivityActions.remove.type])
      .addCase(ActivityActions.reactivate, BasicReducers[ActivityActions.reactivate.type])
      .addCase(ActivityActions.complete, BasicReducers[ActivityActions.complete.type])
      .addCase(ActivityActions.appendOrganizationTimeline, BasicReducers[ActivityActions.appendOrganizationTimeline.type])
      .addCase(ActivityActions.participantUpdate, BasicReducers[ActivityActions.participantUpdate.type])
      .addCase(ActivityActions.tagParticipant, BasicReducers[ActivityActions.tagParticipant.type]);
  },
};

const activitiesSlice = createSlice(activitySliceArgs);

export default activitiesSlice.reducer;

export function buildActivityTypeSelector(missions: boolean) {
  return (state: RootState) => state.activities.list.filter((f) => f.isMission === missions);
}

export function getActiveParticipants(activity: Activity) {
  return Object.values(activity.participants).filter((p) => isParticipantStatusActive(p.timeline[0].status) == true);
}

export function buildActivitySelector(id?: string) {
  return (state: RootState) => (id ? state.activities.list.find((a) => a.id === id) : undefined);
}

export function buildMyActivitySelector() {
  return (state: RootState) => {
    const participantId = state.auth.userInfo?.participantId;
    if (!participantId) {
      return [];
    }

    const myParticipation: { activity: Activity; status: ParticipantUpdate }[] = [];
    for (const activity of state.activities.list) {
      const myUpdate = activity.participants[participantId]?.timeline[0];
      if (myUpdate && myUpdate.status !== ParticipantStatus.NotResponding) {
        myParticipation.push({ activity, status: myUpdate });
      }
    }

    return myParticipation.sort((a, b) => {
      if (a.activity.isMission === b.activity.isMission) {
        return a.activity.startTime > b.activity.startTime ? 1 : -1;
      }
      return a.activity.isMission ? 1 : -1;
    });
  };
}

/**
 * @return Valid options for the early sign in window, with labels.
 */
export const earlySignInWindowOptions: { value: number; label: string }[] = [
  { value: hoursToMilliseconds(4), label: `4 hours` },
  { value: hoursToMilliseconds(12), label: '12 hours' },
  { value: hoursToMilliseconds(24), label: '24 hours' },
  { value: NaN, label: 'Unlimited' },
];

/**
 * @description Members can sign in prior to the start time of a future mission.
 * @return 4 Hours in milliseconds.
 */
export const defaultEarlySigninWindow = earlySignInWindowOptions[0].value;

export function isFuture(time: number) {
  return time > new Date().getTime();
}

export function isPending(a: Activity) {
  return isActive(a) && !isOpen(a);
}

export function isOpen(a: Activity) {
  return isActive(a) && (!a.earlySignInWindow || !isFuture(a.startTime - a.earlySignInWindow));
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
  if (isComplete(a)) {
    return 'Closed';
  }
  if (isStarted(a)) {
    return 'In Progress';
  }
  if (isOpen(a)) {
    return 'Open For Sign In';
  }
  if (isPending(a)) {
    return 'Not Started';
  }
  return '';
}

export function getActivityPath(activity: Activity) {
  return `/${activity.isMission ? 'mission' : 'event'}/${activity.id}`;
}

export const TestBits = {
  activitySliceArgs,
};
