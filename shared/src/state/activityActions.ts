import { createAction } from '@reduxjs/toolkit';

import { ActivityState } from '.';

// The activity summary/CRUD + participant/team/comm actions have all moved to the
// command/event model (shared/commands + shared/events). `reload` remains: it is
// the server -> client full-state snapshot (and the localStorage rehydration).
const reload = createAction('activities/load', (state: ActivityState) => ({
  payload: state,
}));

export const ActivityActions = {
  reload,
};

export type ActivityActionsType = typeof ActivityActions;
