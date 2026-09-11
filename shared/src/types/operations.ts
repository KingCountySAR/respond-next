import { v4 as uuid } from 'uuid';

import { pickSafely } from '../lib/pickSafely';

import { Activity } from './activity';

export type TeamStatus = 'In Base' | 'In Transit' | 'On Assignment' | 'On Scene' | 'Returning To Base' | 'Disbanded';

type Target = { type: string; id: string };
type PlaceTarget = Target & { type: 'place' };
type GroupTarget = Target & { type: 'group' };
type TeamTarget = Target & { type: 'team'; asLeader?: boolean };

/** Where a responder is being assigned: a team (optionally as its leader), a place, or nowhere (undefined = unassign / available). */
export type AssignmentTarget = PlaceTarget | GroupTarget | TeamTarget | undefined;

export type SarGar = 'green' | 'amber' | 'red';

export interface Team {
  id: string;
  name: string;
  gar: SarGar;
  status: TeamStatus;
  assignment?: string;
  notes?: string;
  assignedParticipants: string[];
  assignedEquipment: EquipmentItem[];
}

export interface Group {
  id: string;
  name: string;
  leaderId?: string;
  assignedTeams: string[];
  assignedParticipants: string[];
  assignedEquipment: EquipmentItem[];
}

export interface EquipmentItem {
  id: string;
  type: string;
  uuid?: string;
  name: string;
}

export interface CommunicationsLogEntry {
  id: string;
  to?: string;
  from?: string;
  message: string;
  timestamp: number;
  isAutomated?: boolean;
  isDeleted?: boolean;
  isFavorite?: boolean;
}

export interface Place {
  id: string;
  name: string;
  lat?: string;
  lon?: string;
  notes?: string;
  assignedEquipment: EquipmentItem[];
  assignedParticipants: string[];
}

export function createNewTeam(name: string): Team {
  return {
    id: uuid(),
    name,
    gar: 'green',
    status: 'In Base',
    assignedParticipants: [],
    assignedEquipment: [],
  };
}

export function createNewGroup(name: string): Group {
  return {
    id: uuid(),
    name,
    assignedTeams: [],
    assignedParticipants: [],
    assignedEquipment: [],
  };
}

export function createNewPlace(name: string): Place {
  return {
    id: uuid(),
    name,
    assignedEquipment: [],
    assignedParticipants: [],
  };
}

export function createNewCommsEntry(values: Partial<CommunicationsLogEntry>): CommunicationsLogEntry {
  return {
    id: uuid(),
    from: '',
    to: '',
    message: '',
    timestamp: Date.now(),
    isAutomated: false,
    isDeleted: false,
    isFavorite: false,
    ...values,
  };
}

export const DEFAULT_PLACES = {
  base: 'Command Post',
  field: 'Field',
};

export const isDefaultPlace = (place: Place) => {
  return Object.values(DEFAULT_PLACES).includes(place.name);
};

export const getDefaultPlaces = (activity?: Activity): Place[] => {
  return Object.values(DEFAULT_PLACES).reduce<Place[]>((places, defaultPlaceName) => {
    const exists = activity?.places?.some((p) => p.name === defaultPlaceName);
    if (!exists) {
      return [...places, createNewPlace(defaultPlaceName)];
    }
    return places;
  }, []);
};

export const OPERATIONS_FIELDS = ['teams', 'groups', 'comms', 'staff', 'places'] as const;

export type OperationsFields = (typeof OPERATIONS_FIELDS)[number];

/** The operations-only slice of an activity (the fields the ops dashboard needs). */
export type Operations = Pick<Activity, OperationsFields>;

/**
 * The default operations state the server stamps onto an activity when it is
 * first decorated: empty teams/comms/staff plus the default places (Command Post
 * first, then Field). Built server-side so every client sees identical uuids.
 */
export function createDefaultOperations(): Operations {
  return {
    teams: [],
    groups: [],
    comms: [],
    staff: {},
    places: getDefaultPlaces(),
  };
}

/** True once an activity carries all of its operations properties. Legacy
 * activities loaded from the database may be missing some or all of them. */
export function hasOperations(activity: Activity): boolean {
  return OPERATIONS_FIELDS.every((field) => activity[field] !== undefined);
}

export const sortEquipmentAlphabetically = (left: EquipmentItem, right: EquipmentItem) => {
  return left.name.localeCompare(right.name);
};

export const pickTeamProperties = pickSafely<Partial<Team>>(['id', 'name', 'gar', 'status', 'assignment', 'notes', 'assignedParticipants', 'assignedEquipment']);
