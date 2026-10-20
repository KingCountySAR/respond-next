/** The legacy app's colors and button labels for statuses; their words are the domain's (labels.ts). */
import { PARTICIPANT_STATUS_TEXT, type ActivityPhase, type ParticipantStatus, type StatusStep, type UnitStatus } from '@sync/domain';

export const statusText = (status: ParticipantStatus): string => PARTICIPANT_STATUS_TEXT[status];

const STATUS_COLORS: Partial<Record<ParticipantStatus, string>> = {
  responding: 'green',
  staging: 'green',
  assigned: 'green',
  standby: 'orange',
  remote: 'turquoise',
  clear: 'dimgray',
  demobilizing: 'darkred',
};

export const statusCssColor = (status: ParticipantStatus): string => STATUS_COLORS[status] ?? 'transparent';

const STATUS_MUI_COLORS: Record<ParticipantStatus, 'success' | 'error' | 'warning' | 'disabled'> = {
  unknown: 'disabled',
  notResponding: 'disabled',
  standby: 'warning',
  remote: 'success',
  responding: 'success',
  staging: 'success',
  assigned: 'success',
  demobilizing: 'warning',
  clear: 'error',
};

export const statusMuiColor = (status: ParticipantStatus) => STATUS_MUI_COLORS[status];

/** The legacy status button's label for moving from `from` to `to`. */
export function stepLabel(from: ParticipantStatus, to: ParticipantStatus): string {
  switch (to) {
    case 'standby':
      return 'Stand By';
    case 'remote':
      return 'In Town';
    case 'responding':
      return 'Sign In';
    case 'staging':
      return from === 'assigned' ? 'Available' : 'Arrive Base';
    case 'demobilizing':
      return from === 'staging' ? 'Depart Base' : 'Turn Around';
    case 'clear':
      return from === 'standby' ? 'Stand Down' : 'Sign Out';
    case 'assigned':
      return 'Assigned';
    default:
      return 'Reset Status';
  }
}

/** A status button's label, including "Switch from CRT" / "Sign Out from CRT" when changing units. */
export function stepText(from: ParticipantStatus, step: StatusStep, unitName: (id: string) => string): string {
  if (step.switchingFrom) return step.status === 'clear' ? `Sign Out from ${unitName(step.switchingFrom)}` : `Switch from ${unitName(step.switchingFrom)}`;
  return stepLabel(from, step.status);
}

const PHASE_TEXT: Record<ActivityPhase, string> = {
  closed: 'Closed',
  inProgress: 'In Progress',
  openForSignIn: 'Open For Sign In',
  notStarted: 'Not Started',
};

/** The legacy "Mission Status" text. */
export const phaseText = (phase: ActivityPhase | undefined): string => (phase ? PHASE_TEXT[phase] : '');

/** Roster order when sorting by status, as in the legacy roster. */
export const STATUS_SORT_ORDER: ParticipantStatus[] = ['responding', 'staging', 'assigned', 'demobilizing', 'remote', 'standby', 'clear', 'notResponding', 'unknown'];

/** The legacy organization chip colors: responding green, standby amber, anything else plain. */
export const unitChipColor = (status: UnitStatus): 'success' | 'warning' | 'default' => (status === 'responding' ? 'success' : status === 'standby' ? 'warning' : 'default');
