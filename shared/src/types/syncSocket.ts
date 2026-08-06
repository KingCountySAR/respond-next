import type { Command } from '../commands';
import type { StampedEvent } from '../events';
import type { ActivityState, LocationState } from '../state';

import type UserAuth from './userAuth';

export interface ServerToClientEvents {
  // Full-state snapshot pushed on connect: activities scoped to the user, plus
  // the locations catalog. Applied directly into the client read model.
  snapshot: (payload: { activities: ActivityState; locations: LocationState }) => void;
  // Command/event path: a server-minted, authored fact. Every connected client
  // (including the one that issued the command) applies it.
  event: (event: StampedEvent) => void;
}

export interface ClientToServerEvents {
  // Command/event path: intent. The server authenticates the socket and pairs
  // the command with the session's author before producing events.
  command: (command: Command) => void;
  logout: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  /** Set by the connection-auth middleware from the session cookie. */
  auth: UserAuth;
}
