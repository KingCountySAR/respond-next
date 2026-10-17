/**
 * Which status changes a participant is offered, carried over from the legacy app's status buttons.
 * The UI labels each step from (from, to): demobilizing is "Turn Around" from responding and
 * "Depart Base" from staging.
 */
import { isRespondingStatus, signInOpensAt } from './queries';
import type { ActivityRec, ParticipantStatus } from './schema';

const STEPS: Record<ParticipantStatus, ParticipantStatus[]> = {
  unknown: ['responding', 'standby', 'remote'],
  notResponding: ['responding', 'standby', 'remote'],
  standby: ['responding', 'clear'],
  remote: ['clear'],
  responding: ['staging', 'demobilizing', 'clear'],
  staging: ['demobilizing', 'assigned'],
  assigned: ['staging'],
  demobilizing: ['clear', 'responding', 'staging'],
  clear: ['responding', 'standby', 'remote'],
};

/** Before sign-in opens, or on a standby-only activity: standby and back; anything else can only be reset. */
const STANDBY_ONLY_STEPS: Record<ParticipantStatus, ParticipantStatus[]> = {
  unknown: ['standby'],
  notResponding: ['standby'],
  standby: ['clear'],
  clear: ['standby'],
  remote: ['notResponding'],
  responding: ['notResponding'],
  staging: ['notResponding'],
  assigned: ['notResponding'],
  demobilizing: ['notResponding'],
};

/** Statuses a standby-only participant may set for themselves. */
export const STANDBY_ONLY_STATUSES: ReadonlySet<ParticipantStatus> = new Set(['standby', 'clear', 'notResponding']);

/** Light mode has no remote role and no assignments. */
const LIGHT_MODE_EXCLUDED: ReadonlySet<ParticipantStatus> = new Set(['remote', 'assigned']);

/** The activity fields the rules read; every viewer has them, so field UI can offer the same steps. */
export type StatusRules = Pick<ActivityRec, 'startTime' | 'earlySignInWindow' | 'standbyOnly' | 'mode'>;

/**
 * Self sign-in is standby-only before the sign-in window opens, and on a standby-only activity
 * unless the participant is already responding.
 */
export function isStandbyOnly(activity: StatusRules, current: ParticipantStatus, now: number): boolean {
  return signInOpensAt(activity) > now || (activity.standbyOnly && !isRespondingStatus(current));
}

export function statusSteps(activity: StatusRules, current: ParticipantStatus, now: number): ParticipantStatus[] {
  const steps = isStandbyOnly(activity, current, now) ? STANDBY_ONLY_STEPS[current] : STEPS[current];
  return activity.mode === 'light' ? steps.filter((s) => !LIGHT_MODE_EXCLUDED.has(s)) : steps;
}

export const allowedInMode = (activity: Pick<StatusRules, 'mode'>, status: ParticipantStatus): boolean => activity.mode !== 'light' || !LIGHT_MODE_EXCLUDED.has(status);
