import { Server as IOServer, Socket } from 'socket.io';

import { userAuthor } from '@respond/shared/events';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '@respond/shared/types/syncSocket';

import { ActivityActions, LocationActions } from '@respond/shared';

import { getAuthFromCookieHeader } from './auth';
import { getRelatedOrgIds } from './mongodb';
import { getServices } from './services';

export type SocketInterface = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export class SocketServer extends IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {}

export default class SocketManager {
  private readonly connectedSockets: Record<string, SocketInterface> = {};
  private io?: SocketServer;

  /**
   * Bind this manager to a socket.io server created by the process entry point
   * (server/src/index.ts). Replaces the old lazy `ensureServer` that attached
   * socket.io to Next's HTTP server from an API route.
   */
  async attach(io: SocketServer) {
    if (this.io) {
      console.log('Socket server already attached');
      return;
    }
    console.log('Socket server is initializing');
    this.io = io;

    // Authenticate every connection from the shared session cookie before it is
    // established. The socket carries the same session-id cookie as the HTTP API
    // (same origin), so there is no separate socket key to mint or look up.
    io.use(async (socket, next) => {
      const auth = await getAuthFromCookieHeader(socket.handshake.headers.cookie);
      if (!auth) {
        next(new Error('unauthorized'));
        return;
      }
      socket.data.auth = auth;
      next();
    });

    io.on('connection', (socket) => this.handleNewSocket(socket));
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const manager = this;

    (await getServices()).stateManager.addClient({
      broadcastEvent(events, toRooms) {
        if (!manager.io) {
          return;
        }

        const emitter = toRooms ? manager.io.to(toRooms) : manager.io;
        for (const event of events) {
          emitter.emit('event', event);
        }
      },
    });
  }

  async handleNewSocket(socket: SocketInterface) {
    // The auth middleware guarantees socket.data.auth is set before we get here.
    const auth = socket.data.auth;
    this.connectedSockets[socket.id] = socket;

    socket.on('disconnect', async () => {
      delete this.connectedSockets[socket.id];
    });

    socket.on('command', async (command) => {
      await (await getServices()).stateManager.handleCommand(command, userAuthor(auth.userId, auth.name ?? auth.email));
    });

    const stateManager = (await getServices()).stateManager;
    console.log(`authd socket for ${auth.email}`);
    const userOrgIds = await getRelatedOrgIds(auth.organizationId);
    for (const orgId of userOrgIds) {
      socket.join(`org:${orgId}`);
    }
    socket.emit('broadcastAction', ActivityActions.reload(await stateManager.getStateForUser(auth)), '');
    socket.emit('broadcastAction', LocationActions.reload(stateManager.getLocationState()), '');
  }
}
