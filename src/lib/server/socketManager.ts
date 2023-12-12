import type { Server as HTTPServer } from 'http';

import { ObjectId } from 'mongodb';
import { BroadcastOperator, Server as IOServer, Socket } from 'socket.io';

import type { SocketAuthDoc } from '@respond/types/data/socketAuthDoc';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '@respond/types/syncSocket';
import type UserAuth from '@respond/types/userAuth';

import { LocationActions } from '../client/store/locations';
import { ActivityActions } from '../state';

import mongoPromise, { getRelatedOrgIds } from './mongodb';
import { getServices } from './services';

export type SocketHTTPServer = HTTPServer & { io?: IOServer };

export type SocketInterface = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export class SocketServer extends IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {}

export default class SocketManager {
  private readonly connectedSockets: Record<string, SocketInterface> = {};
  private io?: SocketServer;

  async ensureServer(server: SocketHTTPServer) {
    if (server.io) {
      //console.log('Socket is already running')
    } else {
      console.log('Socket server is initializing');
      this.io = new SocketServer(server);
      server.io = this.io;
      this.io.on('connection', async (socket) => (await getServices()).socketManager.handleNewSocket(socket));
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const manager = this;

      (await getServices()).stateManager.addClient({
        broadcastAction(action, toRooms, reporterId) {
          if (!manager.io) {
            return;
          }
          let emitter: BroadcastOperator<ServerToClientEvents, SocketData> | undefined;
          for (const room of toRooms) {
            emitter = emitter ? emitter.to(room) : manager.io.to(room);
          }
          emitter?.emit('broadcastAction', action, reporterId);
        },
      });
    }
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
        socket.emit('broadcastLocationAction', LocationActions.reload(stateManager.getLocationState()), '');
      }
    });

    socket.on('reportAction', async (action, reporterId) => {
      if (!socket.auth) {
        // TODO, let user know they aren't authenticated
        return;
      }
      (await getServices()).stateManager.handleIncomingAction(action, reporterId, socket.auth);
    });

    socket.on('reportLocationAction', async (action, reporterId) => {
      if (!socket.auth) {
        // TODO, let user know they aren't authenticated
        return;
      }
      (await getServices()).stateManager.handleIncomingLocationAction(action, reporterId, socket.auth);
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
