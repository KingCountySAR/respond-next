import { v4 as uuid } from 'uuid';

import { pickSafely } from '@respond/lib/pickSafely';

export type TeamStatus = 'In Base' | 'In Transit' | 'On Assignment' | 'On Scene' | 'Returning To Base';

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

export const pickTeamProperties = pickSafely<Partial<Team>>(['id', 'name', 'gar', 'status', 'assignment', 'notes', 'assignedParticipants', 'assignedEquipment', 'teamLeaderParticipantId']);
