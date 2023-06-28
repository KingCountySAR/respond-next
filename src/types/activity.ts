import { v4 as uuid } from "uuid";

const pickSafely = <ObjectType>(keys: readonly `${string & keyof ObjectType}`[]) => {
  return (object: any) => {
    const resultObject: ObjectType = {} as unknown as ObjectType;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index] as unknown as keyof ObjectType;
      resultObject[key] = object[key];
    }

    return resultObject as ObjectType;
  }
}

export enum ResponderStatus {
  NotResponding = 0x00,
  Standby = 0x01,
  InTown = 0x03,
  SignedIn = 0x07,
  Available = 0x0B,
  Assigned = 0x1B,
  Demobilized = 0x27,
  SignedOut = 0x21,
}
export enum OrganizationStatus {
  Unknown = 0,
  Invited = 1,
  Evaluating = 2,
  Standby = 3,
  Responding = 4,
  Cleared = 5,
}

export interface ResponderUpdate {
  time: number;
  organizationId: string;
  status: ResponderStatus;
}

export interface Participant {
  id: string;
  firstname: string;
  lastname: string;
  organizationId: string;
  timeline: ResponderUpdate[];
  tags?: string[];
  miles?: number;
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
  mapId: string;
  ownerOrgId: string;
  isMission: boolean;
  asMission: boolean;
  startTime: number;
  endTime?: number;

  participants: Record<string, Participant>;
  organizations: Record<string, ParticipatingOrg>;
}

export const pickActivityProperties = pickSafely<Partial<Activity>>(['id', 'idNumber', 'title', 'location', 'mapId', 'ownerOrgId', 'isMission', 'asMission', 'startTime', 'endTime']);

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
    mapId:'',
    startTime: new Date().getTime(),
    isMission: false,
    asMission: false,
    ownerOrgId: '',
    participants: {},
    organizations: {},
  };
}