import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
import { CommunicationsLogEntry } from '../types/operations';

import { defineEvent } from './defineEvent';

// Facts about the communications log. The `comm` on CommLogged is the complete,
// server-authored entry (id + timestamp stamped once on the server).

export const CommsEvents = {
  CommLogged: defineEvent(
    //
    'evt/comm/logged',
    (state: Draft<ActivityState>, { activityId, comm }: { activityId: string; comm: CommunicationsLogEntry }) => {
      const activity = state.list.find((a) => a.id === activityId);
      if (!activity) return;
      activity.comms = activity.comms ?? [];
      // No dedupe guard needed: comms are server-authored with unique ids and each
      // CommLogged event is applied exactly once per client (no optimistic add).
      activity.comms.push(comm);
    },
  ),

  CommUpdated: defineEvent(
    //
    'evt/comm/updated',
    (state: Draft<ActivityState>, { activityId, commId, updates }: { activityId: string; commId: string; updates: Partial<CommunicationsLogEntry> }) => {
      const activity = state.list.find((a) => a.id === activityId);
      if (!activity || !activity.comms) return;
      const comm = activity.comms.find((entry) => entry.id === commId);
      if (!comm) return;
      Object.assign(comm, updates);
    },
  ),
};
