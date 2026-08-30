import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { ActivityState, BasicEventReducers } from '@respond/shared';
import { ActivityEvents, CommsEvents, ParticipantEvents, PlaceEvents, TeamEvents } from '@respond/shared/events';

import { ReducerBuilderStub } from '../types';

import { RootState } from '.';

/** Every event type that must be reduced into ActivityState. */
type ActivityEventType = keyof typeof BasicEventReducers;

/**
 * Compile-time exhaustiveness guard for the .addCase chain below. `Registered`
 * is the union of type-strings the builder actually handled. If any
 * ActivityEventType is missing, `unhandled` becomes a required argument and the
 * call fails to compile, naming the events still needing an .addCase.
 */
function assertAllEventsHandled<Registered extends ActivityEventType>(
  builder: ReducerBuilderStub<ActivityState, Registered>,
  ...unhandled: [ActivityEventType] extends [Registered] ? [] : [missingAddCaseFor: Exclude<ActivityEventType, Registered>]
): void {
  void builder;
  void unhandled;
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
  reducers: {
    // Full-state snapshot from the server (or localStorage rehydration). This is
    // a read-model concern, not a domain action — hence slice-local.
    reloaded: (state: ActivityState, action: PayloadAction<ActivityState>) => {
      state.list = action.payload.list;
    },
  },
  extraReducers: (builder: ReducerBuilderStub<ActivityState>) => {
    // The chain is passed to assertAllEventsHandled so a forgotten event becomes
    // a compile error. Keep the explicit .addCase per event (greppable / find-refs).
    const registered = builder //
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
      .addCase(ParticipantEvents.ParticipantTagged, BasicEventReducers[ParticipantEvents.ParticipantTagged.type])
      .addCase(TeamEvents.TeamCreated, BasicEventReducers[TeamEvents.TeamCreated.type])
      .addCase(TeamEvents.TeamUpdated, BasicEventReducers[TeamEvents.TeamUpdated.type])
      .addCase(TeamEvents.TeamDeleted, BasicEventReducers[TeamEvents.TeamDeleted.type])
      .addCase(TeamEvents.StaffUpdated, BasicEventReducers[TeamEvents.StaffUpdated.type])
      .addCase(TeamEvents.TeamMemberAssigned, BasicEventReducers[TeamEvents.TeamMemberAssigned.type])
      .addCase(ActivityEvents.ActivityUpdated, BasicEventReducers[ActivityEvents.ActivityUpdated.type])
      .addCase(ActivityEvents.ActivityRemoved, BasicEventReducers[ActivityEvents.ActivityRemoved.type])
      .addCase(ActivityEvents.ActivityCompleted, BasicEventReducers[ActivityEvents.ActivityCompleted.type])
      .addCase(ActivityEvents.ActivityReactivated, BasicEventReducers[ActivityEvents.ActivityReactivated.type])
      .addCase(ActivityEvents.OrganizationTimelineAppended, BasicEventReducers[ActivityEvents.OrganizationTimelineAppended.type])
      .addCase(ActivityEvents.OperationsDecorated, BasicEventReducers[ActivityEvents.OperationsDecorated.type]);
    assertAllEventsHandled(registered);
  },
};

const activitiesSlice = createSlice(activitySliceArgs);

export const { reloaded: activitiesReloaded } = activitiesSlice.actions;

export default activitiesSlice.reducer;

export function buildActivitySelector(id?: string) {
  return (state: RootState) => (id ? state.activities.list.find((a) => a.id === id) : undefined);
}

export const TestBits = {
  activitySliceArgs,
};
