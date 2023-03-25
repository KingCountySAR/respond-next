import type { Socket as NetSocket } from 'net';
import type { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next'
import { withIronSessionApiRoute } from 'iron-session/next';
import { sessionOptions } from '@respond/lib/session';
import { getAuthFromApiCookies } from '@respond/lib/server/auth';
import { getServices } from '@respond/lib/server/services';
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '@respond/types/syncSocket';

export type SocketInterface = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export class SocketServer extends IOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> {
}

interface NextSocketApiResponse extends NextApiResponse {
  socket: NetSocket & {
    server: HTTPServer & {
      io?: IOServer
    }
  };
}

function hasHttpServer(object: NextApiResponse): object is NextSocketApiResponse {
  return 'socket' in object;
}

async function SocketHandler(req: NextApiRequest, res: NextApiResponse) {
  ensureSocketServer(res);

  const user = await getAuthFromApiCookies(req.cookies);
  if (!user) {
    res.status(401).json({message: 'Must authenticate'});
    return;
  }

  const newKey = await (await getServices()).socketManager.getSocketKey(user, req.session.socketKey);
  if (newKey !== req.session.socketKey) {
    req.session.socketKey = newKey;
    await req.session.save();
  }

  res.json({
    key: req.session.socketKey,
  })
};

export default withIronSessionApiRoute(SocketHandler, sessionOptions);

function ensureSocketServer(res: NextApiResponse) {
  if (hasHttpServer(res)) {
    if (res.socket?.server.io) {
      //console.log('Socket is already running')
    } else {
      console.log('Socket server is initializing');
      const io = new SocketServer(res.socket.server);
      res.socket.server.io = io;
      io.on('connection', async socket => (await getServices()).socketManager.handleNewSocket(socket));
    }
  }
}
