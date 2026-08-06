import { createSlice } from '@reduxjs/toolkit';
import { hoursToMilliseconds } from 'date-fns';

import { ActivityActions, ActivityState, BasicActivityReducers, BasicEventReducers } from '@respond/shared';
import { CommsEvents, ParticipantEvents, PlaceEvents } from '@respond/shared/events';
import { Activity, isActive as isParticipantStatusActive, ParticipantStatus, ParticipantUpdate } from '@respond/shared/types/activity';

import { ReducerBuilderStub } from '../types';

import { RootState } from '.';

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
  extraReducers: (builder: ReducerBuilderStub<ActivityState>) => {
    builder //
      .addCase(ActivityActions.reload, BasicActivityReducers[ActivityActions.reload.type])
      .addCase(ActivityActions.update, BasicActivityReducers[ActivityActions.update.type])
      .addCase(ActivityActions.remove, BasicActivityReducers[ActivityActions.remove.type])
      .addCase(ActivityActions.reactivate, BasicActivityReducers[ActivityActions.reactivate.type])
      .addCase(ActivityActions.complete, BasicActivityReducers[ActivityActions.complete.type])
      .addCase(ActivityActions.appendOrganizationTimeline, BasicActivityReducers[ActivityActions.appendOrganizationTimeline.type])
      .addCase(ActivityActions.participantTimelineUpdate, BasicActivityReducers[ActivityActions.participantTimelineUpdate.type])
      .addCase(ActivityActions.participantTimelineAdd, BasicActivityReducers[ActivityActions.participantTimelineAdd.type])
      .addCase(ActivityActions.participantMilesUpdate, BasicActivityReducers[ActivityActions.participantMilesUpdate.type])
      .addCase(ActivityActions.participantEtaUpdate, BasicActivityReducers[ActivityActions.participantEtaUpdate.type])
      .addCase(ActivityActions.participantUpdate, BasicActivityReducers[ActivityActions.participantUpdate.type])
      .addCase(ActivityActions.tagParticipant, BasicActivityReducers[ActivityActions.tagParticipant.type])
      .addCase(ActivityActions.createTeam, BasicActivityReducers[ActivityActions.createTeam.type])
      .addCase(ActivityActions.updateTeam, BasicActivityReducers[ActivityActions.updateTeam.type])
      .addCase(ActivityActions.addComm, BasicActivityReducers[ActivityActions.addComm.type])
      .addCase(ActivityActions.updateComm, BasicActivityReducers[ActivityActions.updateComm.type])
      .addCase(ActivityActions.updateStaff, BasicActivityReducers[ActivityActions.updateStaff.type])
      .addCase(ActivityActions.createPlace, BasicActivityReducers[ActivityActions.createPlace.type])
      .addCase(ActivityActions.updatePlace, BasicActivityReducers[ActivityActions.updatePlace.type])
      .addCase(ActivityActions.deletePlace, BasicActivityReducers[ActivityActions.deletePlace.type])
      .addCase(ActivityActions.batchUpdatePlaces, BasicActivityReducers[ActivityActions.batchUpdatePlaces.type])
      .addCase(ActivityActions.bulkParticipantUpdate, BasicActivityReducers[ActivityActions.bulkParticipantUpdate.type])
      // Phase 2 command/event path: reduce server-minted place + comm events.
      .addCase(PlaceEvents.PlaceCreated, BasicEventReducers[PlaceEvents.PlaceCreated.type])
      .addCase(PlaceEvents.PlaceUpdated, BasicEventReducers[PlaceEvents.PlaceUpdated.type])
      .addCase(PlaceEvents.PlaceDeleted, BasicEventReducers[PlaceEvents.PlaceDeleted.type])
      .addCase(PlaceEvents.PlacesBatchChanged, BasicEventReducers[PlaceEvents.PlacesBatchChanged.type])
      .addCase(CommsEvents.CommLogged, BasicEventReducers[CommsEvents.CommLogged.type])
      .addCase(CommsEvents.CommUpdated, BasicEventReducers[CommsEvents.CommUpdated.type])
      .addCase(ParticipantEvents.ParticipantUpdated, BasicEventReducers[ParticipantEvents.ParticipantUpdated.type])
      .addCase(ParticipantEvents.ParticipantTimelineAdded, BasicEventReducers[ParticipantEvents.ParticipantTimelineAdded.type])
      .addCase(ParticipantEvents.ParticipantTimelineUpdated, BasicEventReducers[ParticipantEvents.ParticipantTimelineUpdated.type])
      .addCase(ParticipantEvents.ParticipantMilesUpdated, BasicEventReducers[ParticipantEvents.ParticipantMilesUpdated.type])
      .addCase(ParticipantEvents.ParticipantEtaUpdated, BasicEventReducers[ParticipantEvents.ParticipantEtaUpdated.type])
      .addCase(ParticipantEvents.ParticipantsBulkUpdated, BasicEventReducers[ParticipantEvents.ParticipantsBulkUpdated.type])
      .addCase(ParticipantEvents.ParticipantTagged, BasicEventReducers[ParticipantEvents.ParticipantTagged.type]);
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
  { value: hoursToMilliseconds(4), label: '4 hours' },
  { value: hoursToMilliseconds(12), label: '12 hours' },
  { value: hoursToMilliseconds(24), label: '24 hours' },
  { value: Infinity, label: 'Open Immediately' },
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
