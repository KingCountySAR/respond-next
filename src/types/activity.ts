import { v4 as uuid } from "uuid";

export enum ResponderStatus {
  Unavailable = 0,
  Standby = 2,
  Responding = 3,
  Cleared = 4,
}
export enum OrganizationStatus {
  Unknown = 0,
  Invited = 1,
  Evaluating = 2,
  Standby = 3,
  Responding = 4,
  Cleared = 5,
}

export interface Participant {
  id: string;
  firstname: string;
  lastname: string;
  organizationId: string;
  timeline: { time: number, status: ResponderStatus }[];
}

export interface ParticipatingOrg {
  id: string;
  title: string;
  rosterName?: string;
  timeline: { time: number, status: OrganizationStatus }[];
}

export interface Activity {
  id: string;
  idNumber: string;
  title: string;
  location: { title: string };
  ownerOrgId: string;
  isMission: boolean;
  asMission: boolean;
  startTime: number;
  participants: Record<string, Participant>;
  organizations: Record<string, ParticipatingOrg>;
}


export type ActivityType = 'missions'|'events';

export interface OrgState {
  list: Activity[],
}

export function createNewActivity(): Activity {
  return {
    id: uuid(),
    idNumber: '',
    title: '',
    location: { title: '' },
    startTime: new Date().getTime(),
    isMission: false,
    asMission: false,
    ownerOrgId: '',
    participants: {},
    organizations: {},
  };
}