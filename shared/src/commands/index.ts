import { ActivityCommands } from './activityCommands';
import { CommsCommands } from './commsCommands';
import { LocationCommands } from './locationCommands';
import { ParticipantCommands } from './participantCommands';
import { PlaceCommands } from './placeCommands';
import { TeamCommands } from './teamCommands';

export { PlaceCommands } from './placeCommands';
export { CommsCommands, type LogCommInput } from './commsCommands';
export { ParticipantCommands } from './participantCommands';
export { TeamCommands } from './teamCommands';
export { LocationCommands } from './locationCommands';
export { ActivityCommands } from './activityCommands';

/** All command creators, keyed by name. */
export const Commands = {
  ...PlaceCommands,
  ...CommsCommands,
  ...ParticipantCommands,
  ...TeamCommands,
  ...LocationCommands,
  ...ActivityCommands,
};

export type CommandsType = typeof Commands;

type AllCommands = {
  [K in keyof CommandsType]: ReturnType<CommandsType[K]>;
};

export type Command = AllCommands[keyof CommandsType];

export function isCommand(object: { type: string }): object is Command {
  return Object.values(Commands).some((c) => c.type === object.type);
}

/** A command as sent over the wire: the domain command plus a client-minted id. */
export type StampedCommand = Command & { id: string };
