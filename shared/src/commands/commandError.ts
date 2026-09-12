/**
 * Thrown by a command handler (or a synchronous reactor) to reject a command
 * with a user-facing reason. Caught centrally by StateManager.processCommand,
 * which converts it into a transient SystemEvents.CommandFailed event
 * delivered only to the socket that issued the command — never persisted to
 * Mongo, never broadcast to anyone else, and nothing else in the batch is
 * committed either.
 */
export class CommandError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'CommandError';
  }
}
