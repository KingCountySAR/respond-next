import { createAction } from '@reduxjs/toolkit';

import { AssignmentTarget, EquipmentItem, Team } from '../types/operations';

// Facts about teams + staff assignments, minted by the server.
export const TeamEvents = {
  TeamCreated: createAction('evt/team/created', (activityId: string, team: Team) => ({
    payload: { activityId, team },
  })),
  TeamUpdated: createAction('evt/team/updated', (activityId: string, updates: Partial<Team> & { id: string }) => ({
    payload: { activityId, updates },
  })),
  TeamDisbanded: createAction('evt/team/disbanded', (activityId: string, id: string, target: AssignmentTarget) => ({
    payload: { activityId, id, target },
  })),
  TeamDeleted: createAction('evt/team/deleted', (activityId: string, id: string, target: AssignmentTarget) => ({
    payload: { activityId, id, target },
  })),
  StaffUpdated: createAction('evt/team/staffUpdated', (activityId: string, staff: Record<string, string>) => ({
    payload: { activityId, staff },
  })),
  // A single responder's assignment changed: the reducer removes them from
  // wherever they were and adds them to `target` (undefined = unassigned).
  // Naming a specific participant lets reactors act on *who* moved (e.g. flip
  // their Assigned/Available status).
  TeamMemberAssigned: createAction('evt/team/memberAssigned', (activityId: string, participantId: string, target?: AssignmentTarget) => ({
    payload: { activityId, participantId, target },
  })),
  // A single piece of equipment moved: the reducer removes it (by uuid) from
  // wherever it was and adds it to `target` (undefined = back to inventory).
  TeamEquipmentAssigned: createAction('evt/team/equipmentAssigned', (activityId: string, item: EquipmentItem, target?: AssignmentTarget) => ({
    payload: { activityId, item, target },
  })),
};
