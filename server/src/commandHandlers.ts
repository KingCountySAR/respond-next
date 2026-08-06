import { Command, CommsCommands, LocationCommands, ParticipantCommands, PlaceCommands, TeamCommands } from '@respond/shared/commands';
import { CommsEvents, DomainEvent, LocationEvents, ParticipantEvents, PlaceEvents, TeamEvents } from '@respond/shared/events';
import { createNewCommsEntry } from '@respond/shared/types/operations';

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
    return [ParticipantEvents.ParticipantUpdated(command.payload.activityId, command.payload.participant, command.payload.update)];
  }
  if (ParticipantCommands.AddParticipantTimeline.match(command)) {
    return [ParticipantEvents.ParticipantTimelineAdded(command.payload.activityId, command.payload.participantId, command.payload.update)];
  }
  if (ParticipantCommands.UpdateParticipantTimeline.match(command)) {
    return [ParticipantEvents.ParticipantTimelineUpdated(command.payload.activityId, command.payload.participantId, command.payload.update, command.payload.index)];
  }
  if (ParticipantCommands.UpdateParticipantMiles.match(command)) {
    return [ParticipantEvents.ParticipantMilesUpdated(command.payload.activityId, command.payload.participantId, command.payload.miles)];
  }
  if (ParticipantCommands.UpdateParticipantEta.match(command)) {
    return [ParticipantEvents.ParticipantEtaUpdated(command.payload.activityId, command.payload.participantId, command.payload.eta)];
  }
  if (ParticipantCommands.BulkUpdateParticipants.match(command)) {
    return [ParticipantEvents.ParticipantsBulkUpdated(command.payload.activityId, command.payload.updates)];
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
  if (TeamCommands.UpdateStaff.match(command)) {
    return [TeamEvents.StaffUpdated(command.payload.activityId, command.payload.staff)];
  }
  if (LocationCommands.UpdateLocation.match(command)) {
    return [LocationEvents.LocationUpdated(command.payload.location)];
  }
  if (LocationCommands.RemoveLocation.match(command)) {
    return [LocationEvents.LocationRemoved(command.payload.locationId)];
  }
  return [];
}
