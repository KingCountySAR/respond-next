import type { StampedCommand } from '../commands';
import type { StampedEvent } from '../events';
import type { ActivityState, LocationState } from '../state';

import type UserAuth from './userAuth';

export interface ServerToClientEvents {
  // Full-state snapshot pushed on connect: activities scoped to the user, plus
  // the locations catalog. Applied directly into the client read model.
  snapshot: (payload: { activities: ActivityState; locations: LocationState }) => void;
  // Command/event path: a batch of server-minted, authored facts from one
  // command (its own events plus any synchronous reactors'). Every connected
  // client (including the one that issued the command) applies them together, in
  // a single render. Always an array, even for a single event.
  events: (events: StampedEvent[]) => void;
}

export interface ClientToServerEvents {
  // Command/event path: intent. The server authenticates the socket and pairs
  // the command with the session's author before producing events.
  command: (command: StampedCommand) => void;
  logout: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  /** Set by the connection-auth middleware from the session cookie. */
  auth: UserAuth;
}
