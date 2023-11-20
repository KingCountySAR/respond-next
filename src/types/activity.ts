import { v4 as uuid } from 'uuid';

import { defaultEarlySigninWindow } from '@respond/lib/client/store/activities';

const pickSafely = <ObjectType>(keys: readonly `${string & keyof ObjectType}`[]) => {
  return (object: any) => {
    const resultObject: ObjectType = {} as unknown as ObjectType;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index] as unknown as keyof ObjectType;
      resultObject[key] = object[key];
    }

    return resultObject as ObjectType;
  };
};

export enum ParticipantStatus {
  NotResponding = 0,
  Remote = 1,
  Standby = 2,
  SignedIn = 3,
  SignedOut = 4,
  Available = 5,
  Assigned = 6,
  Demobilized = 7,
}

const STATUS_MUI_COLORS: Record<ParticipantStatus, 'success' | 'error' | 'warning' | 'disabled'> = {
  [ParticipantStatus.NotResponding]: 'disabled',
  [ParticipantStatus.Standby]: 'warning',
  [ParticipantStatus.Remote]: 'success',
  [ParticipantStatus.SignedIn]: 'success',
  [ParticipantStatus.Available]: 'success',
  [ParticipantStatus.Assigned]: 'success',
  [ParticipantStatus.Demobilized]: 'warning',
  [ParticipantStatus.SignedOut]: 'error',
};

export function getStatusMuiColor(status: ParticipantStatus) {
  return STATUS_MUI_COLORS[status];
}

const STATUS_COLORS: Partial<Record<ParticipantStatus, string>> = {
  [ParticipantStatus.SignedIn]: 'green',
  [ParticipantStatus.Available]: 'green',
  [ParticipantStatus.Assigned]: 'green',
  [ParticipantStatus.Standby]: 'orange',
  [ParticipantStatus.Remote]: 'turquoise',
  [ParticipantStatus.SignedOut]: 'dimgray',
  [ParticipantStatus.Demobilized]: 'darkred',
};

export function getStatusCssColor(status: ParticipantStatus) {
  return STATUS_COLORS[status] ?? 'transparent';
}

const STATUS_TEXT: Record<ParticipantStatus, string> = {
  [ParticipantStatus.NotResponding]: 'Not Responding',
  [ParticipantStatus.Standby]: 'Standby',
  [ParticipantStatus.Remote]: 'In Town',
  [ParticipantStatus.SignedIn]: 'Responding',
  [ParticipantStatus.Available]: 'Available',
  [ParticipantStatus.Assigned]: 'Assigned',
  [ParticipantStatus.Demobilized]: 'Demobilized',
  [ParticipantStatus.SignedOut]: 'Signed Out',
};

export function getStatusText(status: ParticipantStatus) {
  return STATUS_TEXT[status];
}

export function isActive(status: ParticipantStatus) {
  return [ParticipantStatus.Standby, ParticipantStatus.Remote, ParticipantStatus.SignedIn, ParticipantStatus.Available, ParticipantStatus.Assigned, ParticipantStatus.Demobilized].includes(status);
}

export function isInTransit(status: ParticipantStatus) {
  return [ParticipantStatus.SignedIn, ParticipantStatus.Demobilized].includes(status);
}

export function isCheckedIn(status: ParticipantStatus) {
  return [ParticipantStatus.Available, ParticipantStatus.Assigned].includes(status);
}

export enum OrganizationStatus {
  Unknown = 0,
  Invited = 1,
  Evaluating = 2,
  Standby = 3,
  Responding = 4,
  Cleared = 5,
}

export interface ParticipantUpdate {
  time: number;
  organizationId: string;
  status: ParticipantStatus;
}

export interface Participant {
  id: string;
  firstname: string;
  lastname: string;
  organizationId: string;
  timeline: ParticipantUpdate[];
  tags?: string[];
  miles?: number;
}

export interface ParticipatingOrg {
  id: string;
  title: string;
  rosterName?: string;
  timeline: { time: number; status: OrganizationStatus }[];
}

export interface Activity {
  id: string;
  idNumber: string;
  title: string;
  description: string;
  location: { title: string };
  mapId: string;
  ownerOrgId: string;
  isMission: boolean;
  asMission: boolean;
  startTime: number;
  endTime?: number;
  earlySignInWindow?: number;

  participants: Record<string, Participant>;
  organizations: Record<string, ParticipatingOrg>;
}

export const pickActivityProperties = pickSafely<Partial<Activity>>(['id', 'idNumber', 'title', 'description', 'location', 'mapId', 'ownerOrgId', 'isMission', 'asMission', 'startTime', 'endTime', 'earlySignInWindow']);

export type ActivityType = 'missions' | 'events';

export interface OrgState {
  list: Activity[];
}

export function createNewActivity(): Activity {
  return {
    id: uuid(),
    idNumber: '',
    title: '',
    description: '',
    location: { title: '' },
    mapId: '',
    startTime: new Date().getTime(),
    earlySignInWindow: defaultEarlySigninWindow,
    isMission: false,
    asMission: false,
    ownerOrgId: '',
    participants: {},
    organizations: {},
  };
}
