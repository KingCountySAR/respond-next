import type { Action } from '@reduxjs/toolkit';

import type UserAuth from './userAuth';

export interface ServerToClientEvents {
  broadcastAction: (action: Action, reporterId: string) => void;
}

export interface ClientToServerEvents {
  reportAction: (action: Action, reporterId: string) => void;
  logout: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  /** Set by the connection-auth middleware from the session cookie. */
  auth: UserAuth;
}
