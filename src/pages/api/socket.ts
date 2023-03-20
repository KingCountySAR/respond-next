import type { Socket as NetSocket } from 'net';
import type { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next'


export interface SessionState {
  //config: SiteConfig,
  //user: LoginResult,
}

// export interface UserInfoDTO {
//   email: string;
//   userId: string;
//   domain: string;
//   name?: string;
//   given_name?: string;
//   family_name?: string;
//   picture?: string;
// };


export interface WelcomeDTO {
  isNewLogin?: boolean;
  // user?: UserInfoDTO;
}

export interface ServerToClientEvents {
  //welcome: (state: SessionState) => void;
  welcome: (data: WelcomeDTO, respondingTo?: string) => void;
  broadcastAction: (action: { type: string, payload: any}) => void;
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
}

export interface ClientToServerEvents {
  hello: () => void;
  reportAction: (action: { type: string, payload: any}) => void;
  logout: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  name: string;
  age: number;
}

export class SocketServer extends IOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> {
}

export type SocketInterface = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
interface NextSocketApiResponse extends NextApiResponse {
  socket: NetSocket & {
    server: HTTPServer & {
      io?: IOServer
    }
  };
}

const SocketHandler = (_: NextApiRequest, res: NextSocketApiResponse) => {
  if (res.socket?.server.io) {
    //console.log('Socket is already running')
  } else {
    console.log('Socket is initializing')
    const io = new SocketServer(res.socket.server, {
      path: '/api/socket',
    });
    res.socket.server.io = io;
    io.on('connection', socket => {
      console.log('server socket connection');
      socket.emit('welcome', { isNewLogin: true }, 'some value');
      // socket.on('input-change', msg => {
      //   socket.broadcast.emit('update-input', msg)
      // })
    })
  }
  res.end()
}

export default SocketHandler