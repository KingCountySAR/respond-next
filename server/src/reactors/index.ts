import { placeCommsReactor } from './placeCommsReactor';

export type { Reactor, ReactorContext } from './reactor';

/** The production reactor registry, run in order for every minted event. */
export const defaultReactors = [placeCommsReactor];
