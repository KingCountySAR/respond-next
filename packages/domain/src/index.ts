import { MutationRegistry } from '@sync/core';
import * as eventMutations from './mutations/event';
import * as operationMutations from './mutations/operations';
import * as participantMutations from './mutations/participants';

export * from './schema';
export * from './equipment';
export * from './viewer';
export * from './queries';
export * from './statusSteps';
export * from './projector';
export * from './mutations/event';
export * from './mutations/participants';
export * from './mutations/operations';

export const missionMutations = { ...eventMutations, ...participantMutations, ...operationMutations };

export const missionRegistry = new MutationRegistry(Object.values(missionMutations));
