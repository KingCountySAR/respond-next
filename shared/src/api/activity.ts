import { Location } from './location.js';

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
  eta?: number;
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
  location: Location;
  mapId: string;
  ownerOrgId: string;
  isMission: boolean;
  asMission: boolean;
  forceStandbyOnly: boolean;
  startTime: number;
  endTime?: number;
  earlySignInWindow?: number;

  participants: Record<string, Participant>;
  organizations: Record<string, ParticipatingOrg>;
}
