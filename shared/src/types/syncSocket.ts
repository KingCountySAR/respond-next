import type { Action } from '@reduxjs/toolkit';

import type { Command } from '../commands';
import type { StampedEvent } from '../events';

import type UserAuth from './userAuth';

export interface ServerToClientEvents {
  // Legacy action-sync path (still used by domains not yet migrated to commands/events).
  broadcastAction: (action: Action, reporterId: string) => void;
  // Command/event path: a server-minted, authored fact. Every connected client
  // (including the one that issued the command) applies it.
  event: (event: StampedEvent) => void;
}

export interface ClientToServerEvents {
  // Legacy action-sync path.
  reportAction: (action: Action, reporterId: string) => void;
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
