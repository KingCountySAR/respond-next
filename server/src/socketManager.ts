import { ObjectId } from 'mongodb';
import { Server as IOServer, Socket } from 'socket.io';

import type { SocketAuthDoc } from '@respond/shared/types/data/socketAuthDoc';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '@respond/shared/types/syncSocket';
import type UserAuth from '@respond/shared/types/userAuth';

import { ActivityActions, LocationActions } from '@respond/shared';

import mongoPromise, { getRelatedOrgIds } from './mongodb';
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
    io.on('connection', (socket) => this.handleNewSocket(socket));
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const manager = this;

    (await getServices()).stateManager.addClient({
      broadcastAction(action, toRooms, reporterId) {
        if (!manager.io) {
          return;
        }

        const emitter = toRooms ? manager.io.to(toRooms) : manager.io;
        emitter.emit('broadcastAction', action, reporterId);
      },
    });
  }

  async handleNewSocket(socket: SocketInterface & { auth?: UserAuth }) {
    this.connectedSockets[socket.id] = socket;
    let authTimeout: NodeJS.Timeout | undefined = setTimeout(() => {
      console.log('socket did not auth in time. disconnecting');
      socket.disconnect();
    }, 3000);

    socket.on('disconnect', async () => {
      delete this.connectedSockets[socket.id];
    });

    socket.on('hello', async (key) => {
      if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = undefined;
      }

      const mongo = await mongoPromise;
      const socketAuth = await mongo
        .db()
        .collection<SocketAuthDoc>('socketAuth')
        .findOne({ _id: new ObjectId(key) });
      if (!socketAuth) {
        console.log('couldnt find socket auth. disconnecting');
        socket.disconnect();
      } else {
        const stateManager = (await getServices()).stateManager;
        console.log(`authd socket for ${socketAuth.user.email}`);
        socket.auth = socketAuth.user;
        const userOrgIds = await getRelatedOrgIds(socketAuth.user.organizationId);
        for (const orgId of userOrgIds) {
          socket.join(`org:${orgId}`);
        }
        socket.emit('welcome', socket.id);
        socket.emit('broadcastAction', ActivityActions.reload(await stateManager.getStateForUser(socketAuth.user)), '');
        socket.emit('broadcastAction', LocationActions.reload(stateManager.getLocationState()), '');
      }
    });

    socket.on('reportAction', async (action, reporterId) => {
      if (!socket.auth) {
        // TODO, let user know they aren't authenticated
        return;
      }
      (await getServices()).stateManager.handleIncomingAction(action, reporterId, socket.auth);
    });
  }

  async getSocketKey(user: UserAuth, previousKey?: string) {
    const mongo = await mongoPromise;
    if (!previousKey) {
      console.log('didnt find socket session. creating one');
      const socketAuth: SocketAuthDoc = {
        user,
        created: new Date(),
      };
      const inserted = await mongo.db().collection('socketAuth').insertOne(socketAuth);
      return inserted.insertedId.toString();
    }

    // TODO - validate previous key

    return previousKey;
  }
}
