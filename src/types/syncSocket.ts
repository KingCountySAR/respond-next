import { LocationAction } from '@respond/lib/client/store/locations';
import { ActivityAction } from '@respond/lib/state/activityActions';

export interface ServerToClientEvents {
  welcome: (id: string) => void;
  broadcastAction: (action: ActivityAction, reporterId: string) => void;
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
}

export interface ClientToServerEvents {
  hello: (key: string) => void;
  reportLocationAction: (action: LocationAction, reporterId: string) => void;
  reportAction: (action: ActivityAction, reporterId: string) => void;
  logout: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  name: string;
  age: number;
}
