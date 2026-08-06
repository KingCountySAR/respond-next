import { createAction } from '@reduxjs/toolkit';

import { CommunicationsLogEntry } from '../types/operations';

// Facts about the communications log. The `comm` on CommLogged is the complete,
// server-authored entry (id + timestamp stamped once on the server).

const CommLogged = createAction('evt/comm/logged', (activityId: string, comm: CommunicationsLogEntry) => ({
  payload: { activityId, comm },
}));

const CommUpdated = createAction('evt/comm/updated', (activityId: string, commId: string, updates: Partial<CommunicationsLogEntry>) => ({
  payload: { activityId, commId, updates },
}));

export const CommsEvents = {
  CommLogged,
  CommUpdated,
};
