import { v4 as uuid } from 'uuid';

import { pickSafely } from '../pickSafely';

import { Activity } from './activity';

export type TeamStatus = 'In Base' | 'In Transit' | 'On Assignment' | 'On Scene' | 'Returning To Base' | 'Disbanded';

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
  teamLeaderParticipantId: string | null;
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
    teamLeaderParticipantId: null,
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
  field: 'Field (Unassigned)',
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

export const sortEquipmentAlphabetically = (left: EquipmentItem, right: EquipmentItem) => {
  return left.name.localeCompare(right.name);
};

export const pickTeamProperties = pickSafely<Partial<Team>>(['id', 'name', 'gar', 'status', 'assignment', 'notes', 'assignedParticipants', 'assignedEquipment', 'teamLeaderParticipantId']);
