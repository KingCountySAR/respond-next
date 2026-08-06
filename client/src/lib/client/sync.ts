import { Action, isAnyOf } from '@reduxjs/toolkit';
import io, { Socket } from 'socket.io-client';

import type { ClientToServerEvents, ServerToClientEvents } from '@respond/shared/types/syncSocket';

import { ActivityActions, filterInitialActivities } from '@respond/shared';

import { addAppListener, AppDispatch, AppStore } from './store';
import { AuthActions } from './store/auth';
import { Actions as SyncActions } from './store/sync';

export class ClientSync {
  // This property is set during the build method below, so it's effectively set in the constructor
  // and doesn't need a valid value here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dispatch: AppDispatch = undefined as any;
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;

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

    this.socket.on('broadcastAction', (action, reporterId) => this.handleServerAction(action, reporterId));
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
    console.log('starting sync');
    // When we log in/out, we should restart the socket connection.
    this.dispatch(
      addAppListener({
        matcher: isAnyOf(AuthActions.set, AuthActions.logout.fulfilled),
        effect: () => {
          this.restart();
        },
      }),
    );

    // Listen for actions that should have copies sent to the server.
    this.dispatch(
      addAppListener({
        predicate: (action, _currentState, _previousState) => {
          const meta = (action as { meta?: { sync?: boolean } }).meta;
          console.log('SEND SYNC', action, meta?.sync ?? false);
          return meta?.sync ?? false;
        },
        effect: (action, _listenerApi) => {
          console.log('ACTING ON SYNC');
          this.handleLocalAction(action);
        },
      }),
    );

    // Listen for actions that update the activities list. We want to save a copy so we
    // can use it when we reload.
    this.dispatch(
      addAppListener({
        matcher: isAnyOf(ActivityActions.reload, ActivityActions.update),
        effect: (_action, listenerApi) => {
          const activities = listenerApi.getState().activities;
          const cachedActivities = { ...activities, list: filterInitialActivities(activities.list) };
          console.log('SHOULD SAVE TO LOCALSTORAGE', cachedActivities);
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

    if (localStorage.activities) {
      this.dispatch(ActivityActions.reload(JSON.parse(localStorage.activities)));
    }

    await this.restart();
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

  handleLocalAction(action: Action) {
    this.socket.emit('reportAction', action, this.socket.id ?? '');
  }

  handleServerAction(action: Action, reporterId: string) {
    console.log('handleServerAction', reporterId, this.socket.id);
    if (reporterId === this.socket.id) return;
    console.log('YAY handleServerAction', action);
    this.dispatch(action);
  }
}
