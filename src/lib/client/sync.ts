import io, { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@respond/types/syncSocket';
import { addAppListener, AppDispatch, AppStore } from './store';
import { Actions as SyncActions } from './store/sync';
import { isAnyOf } from '@reduxjs/toolkit';
import { apiFetch } from '../api';
import { ActivityAction, ActivityActions } from '../state';
import { connect } from 'http2';
import { AuthActions } from './store/auth';

export class ClientSync {
  // This property is set during the build method below, so it's effectively set in the constructor
  // and doesn't need a valid value here.
  private dispatch: AppDispatch = undefined as any;
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private key: string = '';

  constructor(store: AppStore) {
    this.socket = io('/',
    {
      autoConnect: false,
      transports: ['websocket'],
    });

    this.socket.on('connect', () => this.connected());
    this.socket.on('disconnect', () => this.disconnected());
    // If the next.js server gets restarted it won't automatically restart the socket server.
    // If we can't connect to it we should make sure someone tells it to restart. Would be nice
    // to figure out thos make this call -before- we try to reconnect.
    this.socket.on('connect_error', () => fetch('/api/socket-keepalive?after=error'));

    this.socket.on('welcome', (id) => this.authenticated(id));
    this.socket.on('broadcastAction', (action, reporterId) => this.handleServerAction(action, reporterId));
    this.dispatch = store.dispatch;
  }

  connected(): void {
    this.socket.emit('hello', this.key);
  }

  authenticated(id: string): void {
    this.dispatch?.(SyncActions.connected({ id }));
  }

  disconnected(): void {
    this.dispatch?.(SyncActions.disconnected());
  }

  async start() {
    console.log('starting sync');
    // When we log in/out, we should restart the socket connection.
    this.dispatch(addAppListener({
      matcher: isAnyOf(AuthActions.set, AuthActions.logout.fulfilled),
      effect: () => {
        this.restart();
      }
    }));

    // Listen for actions that should have copies sent to the server.
    this.dispatch(addAppListener({
      predicate: (action, _currentState, _previousState) => {
        console.log('SEND SYNC', action, action.meta?.sync ?? false);
        return action.meta?.sync ?? false;
      },
      effect: (action, _listenerApi) => {
        console.log('ACTING ON SYNC');
        this.handleLocalAction(action as ActivityAction);
      },
    }));

    // Listen for actions that update the activities list. We want to save a copy so we
    // can use it when we reload.
    this.dispatch(addAppListener({
      matcher: isAnyOf(ActivityActions.reload, ActivityActions.update),
      effect: (_action, listenerApi) => {
        console.log('SHOULD SAVE TO LOCALSTORAGE', listenerApi.getState().activities);
        localStorage.activities = JSON.stringify(listenerApi.getState().activities);
      },
    }))

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

    // make sure the socket is listening, and we have an auth token for it...
    this.key = (await apiFetch<{key: string}>('/api/socket-keepalive')).key;
    if (this.key) {
      // and then connect to it.
      this.socket.connect();
    }
  }

  handleLocalAction(action: ActivityAction) {
    this.socket.emit('reportAction', action, this.socket.id);
  }

  handleServerAction(action: ActivityAction, reporterId: string) {
    console.log('handleServerAction', reporterId, this.socket.id);
    if (reporterId === this.socket.id) return;
    console.log('YAY handleServerAction', action);
    this.dispatch(action);
  }
}