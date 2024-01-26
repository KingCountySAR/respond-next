import { Action } from '@reduxjs/toolkit';

export interface ServerToClientEvents {
  welcome: (id: string) => void;
  broadcastAction: (action: Action, reporterId: string) => void;
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
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
