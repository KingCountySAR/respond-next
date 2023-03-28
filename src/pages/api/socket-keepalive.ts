import type { Socket as NetSocket } from 'net';

import type { NextApiRequest, NextApiResponse } from 'next'
import { withIronSessionApiRoute } from 'iron-session/next';
import { sessionOptions } from '@respond/lib/session';
import { getAuthFromApiCookies } from '@respond/lib/server/auth';
import { getServices } from '@respond/lib/server/services';
import type { SocketHTTPServer } from '@respond/lib/server/socketManager';


interface NextSocketApiResponse extends NextApiResponse {
  socket: NetSocket & {
    server: SocketHTTPServer;
  };
}

function hasHttpServer(object: NextApiResponse): object is NextSocketApiResponse {
  return 'socket' in object;
}

async function SocketHandler(req: NextApiRequest, res: NextApiResponse) {
  const socketManager = (await getServices()).socketManager;
  if (hasHttpServer(res)) {
    await socketManager.ensureServer(res.socket.server);
  }

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