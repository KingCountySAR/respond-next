import { CommsCommands } from './commsCommands';
import { PlaceCommands } from './placeCommands';

export { PlaceCommands } from './placeCommands';
export { CommsCommands, type LogCommInput } from './commsCommands';

/** All command creators, keyed by name. */
export const Commands = {
  ...PlaceCommands,
  ...CommsCommands,
};

export type CommandsType = typeof Commands;

type AllCommands = {
  [K in keyof CommandsType]: ReturnType<CommandsType[K]>;
};

export type Command = AllCommands[keyof CommandsType];

export function isCommand(object: { type: string }): object is Command {
  return Object.values(Commands).some((c) => c.type === object.type);
}
