import { Server as IOServer, Socket } from 'socket.io';

import { userAuthor } from '@shared/events';
import type { ClientToServerEvents, InterServerEvents, PresenceUpdate, ServerToClientEvents, SocketData } from '@shared/types/syncSocket';

import { getAuthFromCookieHeader } from './auth';
import { getRelatedOrgIds } from './mongodb';
import { getServices } from './services';

export type SocketInterface = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export class SocketServer extends IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {}

// How long a presence entry is offered to a newly-subscribing client before
// it's considered stale (mirrors the client's own freshness window).
const PRESENCE_WINDOW_MS = 30_000;

export default class SocketManager {
  private readonly connectedSockets: Record<string, SocketInterface> = {};
  private io?: SocketServer;
  // Ephemeral, in-memory only (lost on restart by design, never persisted):
  // topic -> editor (user id) -> their latest ping.
  private readonly presenceByTopic = new Map<string, Map<string, PresenceUpdate>>();
  // Which topics a socket has pinged, so its disconnect cleanup doesn't have
  // to scan every topic.
  private readonly topicsBySocket = new Map<string, Set<string>>();

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
        // One socket message carrying the whole batch, so the client applies it
        // in a single render.
        emitter.emit('events', events);
      },
    });
  }

  async handleNewSocket(socket: SocketInterface) {
    // The auth middleware guarantees socket.data.auth is set before we get here.
    const auth = socket.data.auth;
    this.connectedSockets[socket.id] = socket;

    socket.on('disconnect', async () => {
      delete this.connectedSockets[socket.id];
      this.clearPresenceForSocket(socket);
    });

    socket.on('command', async (command) => {
      await (await getServices()).stateManager.handleCommand(command, userAuthor(auth.userId, auth.name ?? auth.email));
    });

    // Relayed directly to the org room, bypassing StateManager: this is a
    // transient presence signal, not a durable fact to persist or replay.
    socket.on('presencePing', (payload) => {
      const update: PresenceUpdate = { ...payload, editorId: auth.userId, editorName: auth.name ?? auth.email, at: Date.now() };

      let topicMap = this.presenceByTopic.get(payload.topic);
      if (!topicMap) {
        topicMap = new Map();
        this.presenceByTopic.set(payload.topic, topicMap);
      }
      topicMap.set(auth.userId, update);

      let topics = this.topicsBySocket.get(socket.id);
      if (!topics) {
        topics = new Set();
        this.topicsBySocket.set(socket.id, topics);
      }
      topics.add(payload.topic);

      socket.to(`org:${auth.organizationId}`).emit('presenceUpdate', update);
    });

    // Catch-up for a client that opened the form after others already pinged,
    // so it doesn't have to wait for their next ping to learn they're active.
    socket.on('presenceSubscribe', ({ topic }) => {
      socket.emit('presenceSnapshot', { topic, entries: this.getFreshPresence(topic, auth.userId) });
    });

    const stateManager = (await getServices()).stateManager;
    console.log(`authd socket for ${auth.email}`);
    const userOrgIds = await getRelatedOrgIds(auth.organizationId);
    for (const orgId of userOrgIds) {
      socket.join(`org:${orgId}`);
    }
    socket.emit('snapshot', {
      activities: await stateManager.getStateForUser(auth),
      locations: stateManager.getLocationState(),
    });
  }

  private clearPresenceForSocket(socket: SocketInterface) {
    const auth = socket.data.auth;
    const topics = this.topicsBySocket.get(socket.id);
    this.topicsBySocket.delete(socket.id);
    if (!topics || !auth) return;
    for (const topic of topics) {
      this.presenceByTopic.get(topic)?.delete(auth.userId);
    }
  }

  private getFreshPresence(topic: string, excludeEditorId: string): PresenceUpdate[] {
    const topicMap = this.presenceByTopic.get(topic);
    if (!topicMap) return [];

    const now = Date.now();
    const fresh: PresenceUpdate[] = [];
    for (const [editorId, update] of topicMap) {
      if (now - update.at >= PRESENCE_WINDOW_MS) {
        topicMap.delete(editorId); // opportunistic cleanup of stale entries
        continue;
      }
      if (editorId !== excludeEditorId) fresh.push(update);
    }
    return fresh;
  }
}
