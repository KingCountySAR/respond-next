import type { Action } from '@reduxjs/toolkit';

export interface ServerToClientEvents {
  welcome: (id: string) => void;
  broadcastAction: (action: Action, reporterId: string) => void;
}

export interface ClientToServerEvents {
  hello: (key: string) => void;
  reportAction: (action: Action, reporterId: string) => void;
  logout: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  name: string;
  age: number;
}
