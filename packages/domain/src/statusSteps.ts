/**
 * Which status changes a participant is offered, carried over from the legacy app's status buttons.
 * The UI labels each step from (from, to): demobilizing is "Turn Around" from responding and
 * "Depart Base" from staging. Also the status changes a manager can make to a unit.
 */
import { isActiveStatus, isRespondingStatus, signInOpensAt } from './queries';
import type { ActivityRec, ParticipantStatus, UnitStatus } from './schema';

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

/** The activity fields the rules read; every viewer has them, so respond UI can offer the same steps. */
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

/** A status button: the status it sets, and the unit it moves the person off, when switching units. */
export interface StatusStep {
  status: ParticipantStatus;
  /** Set when the person is active under another unit: the step leaves that unit. */
  switchingFrom?: string;
}

/**
 * The status buttons for someone acting under `unitId`. Someone still active under another unit is
 * offered, as in the legacy app, switching to this unit at the same kind of status (in town,
 * standby, or responding) or signing out of the other unit.
 */
export function statusStepsUnder(
  activity: StatusRules,
  current: { status: ParticipantStatus; unitId: string } | undefined,
  unitId: string,
  now: number,
): StatusStep[] {
  if (current && isActiveStatus(current.status) && current.unitId !== unitId) {
    const same: ParticipantStatus = current.status === 'remote' ? 'remote' : current.status === 'standby' ? 'standby' : 'responding';
    return [
      { status: same, switchingFrom: current.unitId },
      { status: 'clear', switchingFrom: current.unitId },
    ];
  }
  return statusSteps(activity, current?.status ?? 'unknown', now).map((status) => ({ status }));
}

export type SettableUnitStatus = Exclude<UnitStatus, 'unknown'>;

/** Which statuses a manager can move a unit to. Declining is only for a unit that hasn't come in. */
const UNIT_STEPS: Record<UnitStatus, SettableUnitStatus[]> = {
  unknown: ['standby', 'responding', 'notResponding', 'invited'],
  invited: ['standby', 'responding', 'notResponding'],
  notResponding: ['standby', 'responding'],
  standby: ['responding', 'stoodDown'],
  responding: ['standby', 'stoodDown'],
  stoodDown: ['standby', 'responding'],
};

export const unitStatusSteps = (current: UnitStatus): SettableUnitStatus[] => UNIT_STEPS[current];

/** A unit out of the activity: setting it signs its members out, and they can't sign themselves back in. */
export const isUnitOut = (status: UnitStatus): boolean => status === 'notResponding' || status === 'stoodDown';

const UNIT_RANK: Record<UnitStatus, number> = { unknown: 0, invited: 0, notResponding: 0, stoodDown: 0, standby: 1, responding: 2 };

/**
 * Where a member signing in moves their unit: up to standby for standby, up to responding for any
 * responding status, never down. Undefined leaves the unit as it is.
 */
export function unitStatusAfterSignIn(unit: UnitStatus, member: ParticipantStatus): SettableUnitStatus | undefined {
  const next = member === 'standby' ? 'standby' : isRespondingStatus(member) ? 'responding' : undefined;
  return next && UNIT_RANK[next] > UNIT_RANK[unit] ? next : undefined;
}
