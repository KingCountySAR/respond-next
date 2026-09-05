import { Action, isAnyOf } from '@reduxjs/toolkit';
import io, { Socket } from 'socket.io-client';
import { v4 as uuid } from 'uuid';

import { type ActivityState, filterInitialActivities, type LocationState } from '@respond/shared';
import { Command, isCommand } from '@respond/shared/commands';
import { ActivityEvents, type StampedEvent } from '@respond/shared/events';
import type { ClientToServerEvents, PresencePing, PresenceSnapshot, PresenceUpdate, ServerToClientEvents } from '@respond/shared/types/syncSocket';

import { addAppListener, AppDispatch, AppStore } from './store';
import { activitiesReloaded } from './store/activities';
import { AuthActions } from './store/auth';
import { locationsReloaded } from './store/locations';
import { PresenceActions, presencePingSent, presenceSubscribeRequested } from './store/presence';
import { Actions as SyncActions } from './store/sync';

export class ClientSync {
  // This property is set during the build method below, so it's effectively set in the constructor
  // and doesn't need a valid value here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dispatch: AppDispatch = undefined as any;
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private started = false;
  private unsubscribeListeners: Array<() => void> = [];

  constructor(store: AppStore) {
    this.socket = io('/', {
      autoConnect: false,
      transports: ['websocket'],
      // Send the same-origin session cookie on the handshake; the server
      // authenticates the connection from it (no separate socket key).
      withCredentials: true,
    });

    this.socket.on('connect', () => this.connected());
    this.socket.on('disconnect', () => this.disconnected());
    // The Hono server owns the socket.io server for its whole lifetime, so there is
    // nothing to "wake up" on connect_error — socket.io's own reconnection handles it.

    this.socket.on('snapshot', (payload) => this.handleSnapshot(payload));
    this.socket.on('events', (events) => this.handleServerEvents(events));
    this.socket.on('presenceUpdate', (payload) => this.handlePresenceUpdate(payload));
    this.socket.on('presenceSnapshot', (payload) => this.handlePresenceSnapshot(payload));
    this.dispatch = store.dispatch;
  }

  connected(): void {
    // The connection is only established once the server has authenticated the
    // session cookie, so reaching here means we're authenticated.
    this.dispatch?.(SyncActions.connected({ id: this.socket.id ?? '' }));
  }

  disconnected(): void {
    this.dispatch?.(SyncActions.disconnected());
  }

  async start() {
    if (this.started) {
      return;
    }
    this.started = true;

    console.log('starting sync');
    // When we log in/out, we should restart the socket connection.
    const authListener = this.dispatch(
      addAppListener({
        matcher: isAnyOf(AuthActions.set, AuthActions.logout.fulfilled),
        effect: () => {
          this.restart();
        },
      }),
    );
    this.unsubscribeListeners.push(authListener as unknown as () => void);

    // Commands (intent) are forwarded to the server, never reduced locally. The
    // authoritative event comes back over the socket and is applied then.
    const commandListener = this.dispatch(
      addAppListener({
        predicate: (action) => isCommand(action),
        effect: (action) => {
          this.emitCommand(action as Command);
        },
      }),
    );
    this.unsubscribeListeners.push(commandListener as unknown as () => void);

    // Ephemeral presence pings never go through the command/event pipeline —
    // forward straight to the socket, nothing to apply locally.
    const presencePingListener = this.dispatch(
      addAppListener({
        actionCreator: presencePingSent,
        effect: (action) => {
          this.emitPresencePing(action.payload);
        },
      }),
    );
    this.unsubscribeListeners.push(presencePingListener as unknown as () => void);

    // Ask the server who's already present for a topic, so a newly opened
    // form learns of an active editor immediately instead of waiting for
    // their next ping.
    const presenceSubscribeListener = this.dispatch(
      addAppListener({
        actionCreator: presenceSubscribeRequested,
        effect: (action) => {
          this.socket.emit('presenceSubscribe', action.payload);
        },
      }),
    );
    this.unsubscribeListeners.push(presenceSubscribeListener as unknown as () => void);

    // Cache the activities list to localStorage so a reload can render immediately,
    // on the initial snapshot (reload) and on activity summary changes.
    const cacheListener = this.dispatch(
      addAppListener({
        matcher: isAnyOf(activitiesReloaded, ActivityEvents.ActivityUpdated),
        effect: (_action, listenerApi) => {
          const activities = listenerApi.getState().activities;
          const cachedActivities = { ...activities, list: filterInitialActivities(activities.list) };
          try {
            const serializedActivities = JSON.stringify(cachedActivities);

            // remove activities from localStorage to then ...
            localStorage.removeItem('activities');
            // ... update with the fresh list
            localStorage.setItem('activities', serializedActivities);
          } catch (error) {
            console.warn('Unable to save filtered activities cache', error);
          }
        },
      }),
    );
    this.unsubscribeListeners.push(cacheListener as unknown as () => void);

    if (localStorage.activities) {
      this.dispatch(activitiesReloaded(JSON.parse(localStorage.activities)));
    }

    await this.restart();
  }

  stop() {
    if (!this.started) {
      return;
    }

    this.started = false;

    for (const unsubscribe of this.unsubscribeListeners) {
      unsubscribe();
    }
    this.unsubscribeListeners = [];

    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }

  async restart() {
    console.log('restarting sync');
    if (this.socket.connected) {
      this.socket.disconnect();
    }
    // Reconnect; the browser sends the current session cookie on the handshake,
    // so a login/logout since the last connect is picked up automatically.
    this.socket.connect();
  }

  // Full-state snapshot pushed by the server on connect. Applied directly into
  // the read model (activities scoped to this user, plus the locations catalog).
  handleSnapshot(payload: { activities: ActivityState; locations: LocationState }) {
    this.dispatch(activitiesReloaded(payload.activities));
    this.dispatch(locationsReloaded(payload.locations));
  }

  emitCommand(command: Command) {
    this.socket.emit('command', { ...command, id: uuid() });
  }

  emitPresencePing(payload: PresencePing) {
    this.socket.emit('presencePing', payload);
  }

  handlePresenceUpdate(payload: PresenceUpdate) {
    this.dispatch(PresenceActions.presenceUpdateReceived(payload));
  }

  handlePresenceSnapshot(payload: PresenceSnapshot) {
    this.dispatch(PresenceActions.presenceSnapshotReceived(payload));
  }

  // A batch of server-minted facts from one command. Applied by every client,
  // including the one that issued the command (no reporter exclusion — the client
  // did not optimistically apply it). Dispatching the batch within this single
  // socket callback lets React 18 auto-batching collapse it into one render.
  handleServerEvents(events: StampedEvent[]) {
    for (const event of events) {
      this.dispatch(event as unknown as Action);
    }
  }
}
