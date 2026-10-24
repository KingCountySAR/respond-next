import { MutationRegistry } from '@sync/core';
import * as lifecycle from './mutations/activity';
import * as operations from './mutations/operations';
import * as participants from './mutations/participants';
import * as summaries from './summary';
import * as log from './activityLog';

export * from './schema';
export * from './equipment';
export * from './viewer';
export * from './queries';
export * from './statusSteps';
export * from './site';
export * from './organizations';
export * from './session';
export * from './members';
export * from './locations';
export * from './weather';
export * from './summary';
export * from './labels';
export * from './activityLog';
export * from './projector';
export * from './mutations/activity';
export * from './mutations/participants';
export * from './mutations/operations';

export const activityMutations = { ...lifecycle, ...participants, ...operations, setActivitySummary: summaries.setActivitySummary, appendLog: log.appendLog, setLogFavorite: log.setLogFavorite };

/** Any one of the activity mutations; `SyncClient<ActivityMutation>` takes them by name with typed args. */
export type ActivityMutation = (typeof activityMutations)[keyof typeof activityMutations];

export const activityRegistry = new MutationRegistry(Object.values(activityMutations));
