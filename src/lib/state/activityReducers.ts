import { Draft } from '@reduxjs/toolkit';
import merge from 'lodash.merge';

import { createNewActivity, ParticipantStatus, pickActivityProperties } from '@respond/types/activity';
import { pickTeamProperties } from '@respond/types/operations';

import { ActivityActions, ActivityActionsType } from './activityActions';

import { ActivityState } from '.';

function signOutFromOtherActivities(state: Draft<ActivityState>, activityId: string, participantId: string, time: number) {
  state.list
    .filter((f) => f.id !== activityId && f.participants[participantId])
    .forEach((otherActivity) => {
      const timeline = otherActivity.participants[participantId].timeline;
      if (timeline[0].status === ParticipantStatus.SignedIn) {
        timeline.unshift({
          time,
          status: ParticipantStatus.SignedOut,
          organizationId: timeline[0].organizationId,
        });
      }
    });
}

type ActivityReducers = {
  [K in keyof ActivityActionsType as ActivityActionsType[K]['type']]: (state: Draft<ActivityState>, action: { payload: ReturnType<ActivityActionsType[K]>['payload'] }) => void;
};

export const BasicReducers: ActivityReducers = {
  [ActivityActions.reload.type]: (state, { payload }) => {
    state.list = payload.list;
  },

  [ActivityActions.update.type]: (state, { payload }) => {
    let target = state.list.find((a) => a.id === payload.id);
    if (!target) {
      target = createNewActivity();
      state.list.push(target);
    }
    const trimmedToProps = pickActivityProperties(payload);
    merge(target, trimmedToProps);
  },

  [ActivityActions.createPlace.type]: (state, { payload }) => {
    const activity = state.list.find((a) => a.id === payload.activityId);
    if (activity) {
      activity.places = [...(activity.places ?? []), payload.place];
      return;
    }

    const newActivity = createNewActivity();
    newActivity.id = payload.activityId;
    newActivity.places = [payload.place];
    state.list.push(newActivity);
  },

  [ActivityActions.updatePlace.type]: (state, { payload }) => {
    const activity = state.list.find((a) => a.id === payload.activityId);
    if (!activity) return;
    activity.places = (activity.places ?? []).map((place) => (place.id === payload.place.id ? payload.place : place));
  },

  [ActivityActions.deletePlace.type]: (state, { payload }) => {
    const activity = state.list.find((a) => a.id === payload.activityId);
    if (!activity) return;
    activity.places = (activity.places ?? []).filter((place) => place.id !== payload.placeId);
  },

  [ActivityActions.batchUpdatePlaces.type]: (state, { payload }) => {
    const activity = state.list.find((a) => a.id === payload.activityId);
    if (!activity) return;
    const deleteSet = new Set(payload.deleteIds);
    const upsertMap = new Map(payload.upserts.map((p) => [p.id, p]));
    const kept = (activity.places ?? []).filter((p) => !deleteSet.has(p.id)).map((p) => upsertMap.get(p.id) ?? p);
    const created = payload.upserts.filter((p) => !(activity.places ?? []).some((existing) => existing.id === p.id));
    activity.places = [...kept, ...created];
  },

  [ActivityActions.remove.type]: (state, { payload }) => {
    state.list = state.list.filter((f) => f.id !== payload.id);
  },

  [ActivityActions.reactivate.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.id);
    if (activity) {
      activity.endTime = undefined;
    }
  },

  [ActivityActions.complete.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.id);
    if (activity) {
      // First set the end time
      activity.endTime = payload.endTime;

      // Then clear every participant
      for (const pId in activity.participants) {
        const participant = activity.participants[pId];
        BasicReducers['participant/update'](state, {
          payload: {
            activityId: activity.id,
            participant: {
              ...participant,
              // avoid TypeScript error abount optional vs number|undefined
              miles: participant.miles,
              eta: participant.eta,
            },
            update: {
              time: payload.endTime,
              status: ParticipantStatus.SignedOut,
            },
          },
        });
      }
    }
  },

  [ActivityActions.appendOrganizationTimeline.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (activity) {
      activity.organizations[payload.orgId] = Object.assign(activity.organizations[payload.orgId] ?? { timeline: [] }, payload.org);
      activity.organizations[payload.orgId].timeline.unshift(payload.status);
    }
  },

  [ActivityActions.participantUpdate.type]: (state, { payload }) => {
    // TODO - doesn't support insert time events. Times must always be more recent than the last update.
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (activity) {
      let person = activity.participants[payload.participant.id];
      if (person) {
        const lastUpdate = person.timeline[0];
        if (lastUpdate.organizationId !== payload.participant.organizationId) {
          person.tags = undefined;
          const signoutFromPreviousOrg = {
            organizationId: lastUpdate.organizationId,
            time: payload.update.time,
            status: ParticipantStatus.SignedOut,
          };
          if (payload.update.status === ParticipantStatus.SignedOut) {
            // If they are logging out, log them out of the previous org, then exit.
            person.timeline.unshift(signoutFromPreviousOrg);
            return;
          } else if (lastUpdate.status !== ParticipantStatus.SignedOut && lastUpdate.status !== ParticipantStatus.NotResponding) {
            // If they are remaining active, log them out of the previous org, then continue.
            person.timeline.unshift(signoutFromPreviousOrg);
          }
        } else if (lastUpdate.status === payload.update.status) {
          // Don't record updates if there's no change in status.
          return;
        }
      } else {
        person = {
          ...payload.participant,
          timeline: [],
        };
        activity.participants[payload.participant.id] = person;
      }
      Object.assign(person, payload.participant);
      person.timeline.unshift({
        ...payload.update,
        organizationId: payload.participant.organizationId,
      });

      // If this is a sign-in and the user is already signed into another activity, sign them out of the other activity.
      if (payload.update.status !== ParticipantStatus.SignedIn) {
        signOutFromOtherActivities(state, payload.activityId, payload.participant.id, payload.update.time);
      }
    }
  },

  [ActivityActions.bulkParticipantUpdate.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) return;

    for (const updateRequest of payload.updates) {
      const participant = activity.participants[updateRequest.participantId];
      if (!participant) continue;

      BasicReducers[ActivityActions.participantUpdate.type](state, {
        payload: {
          activityId: payload.activityId,
          participant: {
            id: participant.id,
            firstname: participant.firstname,
            lastname: participant.lastname,
            organizationId: updateRequest.update.organizationId,
            miles: participant.miles,
            eta: participant.eta,
          },
          update: updateRequest.update,
        },
      });
    }
  },

  [ActivityActions.participantTimelineUpdate.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    const person = activity.participants[payload.participantId];
    if (!person) {
      return;
    }
    person.timeline[payload.index] = payload.update;
  },

  [ActivityActions.participantTimelineAdd.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) return;
    const person = activity.participants[payload.participantId];
    if (!person) return;

    person.timeline.unshift(payload.update);

    // If this is a sign-in and the user is already signed into another activity, sign them out of the other activity.
    if (payload.update.status === ParticipantStatus.SignedIn) {
      signOutFromOtherActivities(state, payload.activityId, payload.participantId, payload.update.time);
    }
  },

  [ActivityActions.participantMilesUpdate.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    const person = activity.participants[payload.participantId];
    if (!person) {
      return;
    }
    person.miles = payload.miles;
  },

  [ActivityActions.participantEtaUpdate.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    const person = activity.participants[payload.participantId];
    if (!person) {
      return;
    }

    person.eta = payload.eta;
  },

  [ActivityActions.tagParticipant.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (activity) {
      const person = activity.participants[payload.participantId];
      if (person) {
        person.tags = payload.tags;
      }
    }
  },

  [ActivityActions.createTeam.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    activity.teams = activity.teams ?? [];
    activity.teams.push(payload.team);
  },

  [ActivityActions.addComm.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    activity.comms = activity.comms ?? [];
    // guard against sync replay applying the same entry twice
    if (activity.comms.some((c) => c.id === payload.comm.id)) return;
    activity.comms.push(payload.comm);
  },

  [ActivityActions.updateComm.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity || !activity.comms) {
      return;
    }
    const comm = activity.comms.find((entry) => entry.id === payload.commId);
    if (!comm) {
      return;
    }
    Object.assign(comm, payload.updates);
  },

  [ActivityActions.updateStaff.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity) {
      return;
    }
    activity.staff = {
      ...(activity.staff ?? {}),
      ...payload.staff,
    };
  },

  [ActivityActions.updateTeam.type]: (state, { payload }) => {
    const activity = state.list.find((f) => f.id === payload.activityId);
    if (!activity || !activity.teams) {
      return;
    }
    const team = activity.teams.find((t) => t.id === payload.updates.id);
    if (!team) {
      return;
    }
    const trimmedUpdates = pickTeamProperties(payload.updates);
    Object.assign(team, trimmedUpdates);
  },
};
