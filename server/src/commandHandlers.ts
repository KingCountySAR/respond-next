import { Command, CommsCommands, PlaceCommands } from '@respond/shared/commands';
import { CommsEvents, DomainEvent, PlaceEvents } from '@respond/shared/events';
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
  return [];
}
