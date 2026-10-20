/**
 * The words the app shows for statuses, keyed by the domain's names, for the UI and the activity log
 * alike. The domain names differ from the legacy ones: responding was "Signed In", staging
 * "Available", demobilizing "Demobilized", clear "Signed Out".
 */
import type { Gar, ParticipantStatus, TeamStatus, UnitStatus } from './schema';

export const PARTICIPANT_STATUS_TEXT: Record<ParticipantStatus, string> = {
  unknown: 'Not Responding',
  notResponding: 'Not Responding',
  standby: 'Standby',
  remote: 'In Town',
  responding: 'Responding',
  staging: 'Available',
  assigned: 'Assigned',
  demobilizing: 'Demobilized',
  clear: 'Signed Out',
};

export const TEAM_STATUS_TEXT: Record<TeamStatus, string> = {
  inBase: 'In Base',
  inTransit: 'In Transit',
  onAssignment: 'On Assignment',
  onScene: 'On Scene',
  returningToBase: 'Returning To Base',
  disbanded: 'Disbanded',
};

export const UNIT_STATUS_TEXT: Record<UnitStatus, string> = {
  unknown: 'Unknown',
  invited: 'Invited',
  notResponding: 'Not Responding',
  standby: 'Standby',
  responding: 'Responding',
  stoodDown: 'Stood Down',
};

export const GAR_TEXT: Record<Gar, string> = { green: 'Green', amber: 'Amber', red: 'Red' };
