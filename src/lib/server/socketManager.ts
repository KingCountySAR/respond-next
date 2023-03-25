import { SocketInterface } from '@respond/pages/api/socket-keepalive';
import { SocketAuthDoc } from '@respond/types/data/socketAuthDoc';
import UserAuth from '@respond/types/userAuth';
import { ObjectId } from 'mongodb';
import { ActivityActions } from '../state';
import mongoPromise from './mongodb';
import { getServices } from './services';

export default class SocketManager {
  private readonly connectedSockets: Record<string, SocketInterface> = {};

  async handleNewSocket(socket: SocketInterface & { auth?: UserAuth }) {
    this.connectedSockets[socket.id] = socket;
    let authTimeout: NodeJS.Timeout|undefined = setTimeout(() => {
      console.log('socket did not auth in time. disconnecting');
      socket.disconnect();
    }, 3000);

    socket.on('disconnect', async () => {
      delete this.connectedSockets[socket.id];
      (await getServices()).stateManager.removeClient(socket.id);
    });

    socket.on('hello', async key => {
      if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = undefined;
      }

      const mongo = await mongoPromise;
      const socketAuth = await mongo.db().collection<SocketAuthDoc>('socketAuth').findOne({ _id: new ObjectId(key) });
      if (!socketAuth) {
        console.log('couldnt find socket auth. disconnecting');
        socket.disconnect();
      } else {
        console.log(`authd socket for ${socketAuth.user.email}`);
        socket.auth = socketAuth.user;
        const stateManager = (await getServices()).stateManager;
        stateManager.addClient({
          id: socket.id,
          broadcastAction(action, reporterId) {
            socket.emit('broadcastAction', action, reporterId);
          },
        })
        socket.emit('welcome', socket.id);
        socket.emit('broadcastAction', ActivityActions.reload(stateManager.getStateForUser(socketAuth.user)), '');
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
        created: new Date()
      }
      const inserted = await mongo.db().collection('socketAuth').insertOne(socketAuth);
      return inserted.insertedId.toString()
    }

    // TODO - validate previous key

    return previousKey;
  }
}