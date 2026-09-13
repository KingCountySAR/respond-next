import { groupCommsReactor } from './groupCommsReactor';
import { groupDeleteReactor } from './groupDeletedReactor';
import { participantAssignmentReactor } from './participantAssignmentReactor';
import { placeCommsReactor } from './placeCommsReactor';
import { teamCommsReactor } from './teamCommsReactor';
import { teamDisbandReactor } from './teamDisbandedReactor';

export type { Reactor, ReactorContext } from './reactor';

// Tagging a newly-present participant used to be a separate async reactor
// here (participantTagReactor.ts, removed). It needed the same member-provider
// fetch AddParticipantTimeline's handler now makes to resolve a new
// participant's name — so tagging was folded into that handler instead,
// landing in the same batch rather than a later, flicker-causing broadcast.

/** The production reactor registry, run in order for every minted event. */
export const defaultReactors = [
  //
  placeCommsReactor,
  teamCommsReactor,
  participantAssignmentReactor,
  teamDisbandReactor,
  groupCommsReactor,
  groupDeleteReactor,
];
