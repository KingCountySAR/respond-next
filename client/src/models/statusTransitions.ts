import { ParticipantStatus } from '@respond/shared/types/activity';

/** A single status-change option: the button id, the resulting status, and its label. */
export interface Transition {
  id: number;
  newStatus: ParticipantStatus;
  text: string;
}

/**
 * The catalog of status-change buttons keyed by a stable name. Ids are the values
 * the SplitButton reports on click; labels are UI text (note they differ from the
 * enum names — e.g. Remote → "In Town", SignedIn → "Sign In").
 */
export const statusTransitions = {
  standBy: { id: 0, newStatus: ParticipantStatus.Standby, text: 'Stand By' },
  standDown: { id: 1, newStatus: ParticipantStatus.SignedOut, text: 'Stand Down' },
  inTown: { id: 2, newStatus: ParticipantStatus.Remote, text: 'In Town' },
  signIn: { id: 3, newStatus: ParticipantStatus.SignedIn, text: 'Sign In' },
  turnAround: { id: 4, newStatus: ParticipantStatus.Demobilized, text: 'Turn Around' },
  arriveBase: { id: 5, newStatus: ParticipantStatus.Available, text: 'Arrive Base' },
  departBase: { id: 6, newStatus: ParticipantStatus.Demobilized, text: 'Depart Base' },
  signOut: { id: 7, newStatus: ParticipantStatus.SignedOut, text: 'Sign Out' },
  // Clear status in edge cases that shouldn't generally be possible.
  resetStatus: { id: 8, newStatus: ParticipantStatus.NotResponding, text: 'Reset Status' },
  assigned: { id: 9, newStatus: ParticipantStatus.Assigned, text: 'Assigned' },
  available: { id: 10, newStatus: ParticipantStatus.Available, text: 'Available' },
} satisfies Record<string, Transition>;

const statusOptions: Record<ParticipantStatus, Transition[]> = {
  [ParticipantStatus.NotResponding]: [statusTransitions.signIn, statusTransitions.standBy, statusTransitions.inTown],
  [ParticipantStatus.Standby]: [statusTransitions.signIn, statusTransitions.standDown],
  [ParticipantStatus.Remote]: [statusTransitions.signOut],
  [ParticipantStatus.SignedIn]: [statusTransitions.arriveBase, statusTransitions.turnAround, statusTransitions.signOut],
  [ParticipantStatus.Available]: [statusTransitions.departBase, statusTransitions.assigned],
  [ParticipantStatus.Assigned]: [statusTransitions.available],
  [ParticipantStatus.Demobilized]: [statusTransitions.signOut, statusTransitions.signIn, statusTransitions.arriveBase],
  [ParticipantStatus.SignedOut]: [statusTransitions.signIn, statusTransitions.standBy, statusTransitions.inTown],
};

const standbyOnlyStatusOptions: Record<ParticipantStatus, Transition[]> = {
  [ParticipantStatus.NotResponding]: [statusTransitions.standBy],
  [ParticipantStatus.Standby]: [statusTransitions.standDown],
  [ParticipantStatus.Remote]: [statusTransitions.resetStatus],
  [ParticipantStatus.SignedIn]: [statusTransitions.resetStatus],
  [ParticipantStatus.Available]: [statusTransitions.resetStatus],
  [ParticipantStatus.Assigned]: [statusTransitions.resetStatus],
  [ParticipantStatus.Demobilized]: [statusTransitions.resetStatus],
  [ParticipantStatus.SignedOut]: [statusTransitions.standBy],
};

/** The transition options offered for the current status (standby-only or normal). */
export function pickStatusOptions(current: ParticipantStatus | undefined, standbyOnly: boolean): Transition[] {
  const status = current ?? ParticipantStatus.NotResponding;
  return standbyOnly ? standbyOnlyStatusOptions[status] : statusOptions[status];
}

/** Look up a transition by its button id (used to resolve the confirm label/status). */
export function transitionById(id: number): Transition | undefined {
  return Object.values(statusTransitions).find((t) => t.id === id);
}
