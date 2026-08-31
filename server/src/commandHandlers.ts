import { v4 as uuid } from 'uuid';

import { ActivityCommands, Command, CommsCommands, LocationCommands, ParticipantCommands, PlaceCommands, TeamCommands } from '@shared/commands';
import { ActivityEvents, CommsEvents, DomainEvent, LocationEvents, ParticipantEvents, PlaceEvents, TeamEvents } from '@shared/events';
import { createDefaultOperations, createNewCommsEntry } from '@shared/types/operations';

/**
 * The command handler: validate a command and produce the resulting domain
 * event(s). Pure and synchronous so it is trivially unit-testable. The server
 * (StateManager.handleCommand) is what stamps author/timestamp, reduces, and
 * persists — this only decides *what happened*.
 *
 * This is where the server becomes the single author of facts: LogComm builds
 * the complete comms entry here (stamping a fresh id + timestamp via
 * createNewCommsEntry) so no client or reactor ever mints a comm id.
 */
export function produceEvents(command: Command): DomainEvent[] {
  if (PlaceCommands.CreatePlace.match(command)) {
    return [PlaceEvents.PlaceCreated(command.payload.activityId, command.payload.place)];
  }
  if (PlaceCommands.UpdatePlace.match(command)) {
    return [PlaceEvents.PlaceUpdated(command.payload.activityId, command.payload.place)];
  }
  if (PlaceCommands.DeletePlace.match(command)) {
    return [PlaceEvents.PlaceDeleted(command.payload.activityId, command.payload.placeId)];
  }
  if (PlaceCommands.BatchUpdatePlaces.match(command)) {
    return [PlaceEvents.PlacesBatchChanged(command.payload.activityId, command.payload.upserts, command.payload.deleteIds)];
  }
  if (CommsCommands.LogComm.match(command)) {
    const comm = createNewCommsEntry(command.payload.entry);
    return [CommsEvents.CommLogged(command.payload.activityId, comm)];
  }
  if (CommsCommands.UpdateComm.match(command)) {
    return [CommsEvents.CommUpdated(command.payload.activityId, command.payload.commId, command.payload.updates)];
  }
  if (ParticipantCommands.UpdateParticipant.match(command)) {
    // Server authors the timeline entry's stable id (see UpdateParticipantTimeline).
    return [ParticipantEvents.ParticipantUpdated(command.payload.activityId, command.payload.participant, { ...command.payload.update, id: uuid() })];
  }
  if (ParticipantCommands.AddParticipantTimeline.match(command)) {
    return [ParticipantEvents.ParticipantTimelineAdded(command.payload.activityId, command.payload.participantId, { ...command.payload.update, id: uuid() })];
  }
  if (ParticipantCommands.UpdateParticipantTimeline.match(command)) {
    // An edit keeps the entry's existing id (client echoes it back) so it targets
    // the same row; only the create paths above mint fresh ids.
    return [ParticipantEvents.ParticipantTimelineUpdated(command.payload.activityId, command.payload.participantId, command.payload.update)];
  }
  if (ParticipantCommands.UpdateParticipantMiles.match(command)) {
    return [ParticipantEvents.ParticipantMilesUpdated(command.payload.activityId, command.payload.participantId, command.payload.miles)];
  }
  if (ParticipantCommands.UpdateParticipantEta.match(command)) {
    return [ParticipantEvents.ParticipantEtaUpdated(command.payload.activityId, command.payload.participantId, command.payload.eta)];
  }
  if (ParticipantCommands.BulkUpdateParticipants.match(command)) {
    const updates = command.payload.updates.map((u) => ({ ...u, update: { ...u.update, id: uuid() } }));
    return [ParticipantEvents.ParticipantsBulkUpdated(command.payload.activityId, updates)];
  }
  if (ParticipantCommands.TagParticipant.match(command)) {
    return [ParticipantEvents.ParticipantTagged(command.payload.activityId, command.payload.participantId, command.payload.tags)];
  }
  if (TeamCommands.CreateTeam.match(command)) {
    return [TeamEvents.TeamCreated(command.payload.activityId, command.payload.team)];
  }
  if (TeamCommands.UpdateTeam.match(command)) {
    return [TeamEvents.TeamUpdated(command.payload.activityId, command.payload.updates)];
  }
  if (TeamCommands.DeleteTeam.match(command)) {
    return [TeamEvents.TeamDeleted(command.payload.activityId, { id: command.payload.id })];
  }
  if (TeamCommands.UpdateStaff.match(command)) {
    return [TeamEvents.StaffUpdated(command.payload.activityId, command.payload.staff)];
  }
  if (TeamCommands.AssignTeamMember.match(command)) {
    // Thin event: name the participant + target and let the reducer move them.
    return [TeamEvents.TeamMemberAssigned(command.payload.activityId, command.payload.participantId, command.payload.target)];
  }
  if (TeamCommands.AssignEquipment.match(command)) {
    return [TeamEvents.EquipmentAssigned(command.payload.activityId, command.payload.itemId, command.payload.target)];
  }
  if (LocationCommands.UpdateLocation.match(command)) {
    return [LocationEvents.LocationUpdated(command.payload.location)];
  }
  if (LocationCommands.RemoveLocation.match(command)) {
    return [LocationEvents.LocationRemoved(command.payload.locationId)];
  }
  if (ActivityCommands.UpdateActivity.match(command)) {
    return [ActivityEvents.ActivityUpdated(command.payload.updates)];
  }
  if (ActivityCommands.RemoveActivity.match(command)) {
    return [ActivityEvents.ActivityRemoved(command.payload.activityId)];
  }
  if (ActivityCommands.CompleteActivity.match(command)) {
    return [ActivityEvents.ActivityCompleted(command.payload.activityId, command.payload.endTime)];
  }
  if (ActivityCommands.ReactivateActivity.match(command)) {
    return [ActivityEvents.ActivityReactivated(command.payload.activityId)];
  }
  if (ActivityCommands.AppendOrganizationTimeline.match(command)) {
    return [ActivityEvents.OrganizationTimelineAppended(command.payload.activityId, command.payload.orgId, command.payload.org, command.payload.status)];
  }
  if (ActivityCommands.DecorateOperations.match(command)) {
    // The server is the authority for the default operations state (including
    // the default places' ids), so it builds them here rather than trusting the
    // client. The mutator only fills unset fields, so this stays idempotent.
    return [ActivityEvents.OperationsDecorated(command.payload.activityId, createDefaultOperations())];
  }
  return [];
}
