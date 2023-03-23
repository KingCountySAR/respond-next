import io, { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@respond/types/syncSocket';
import { AppDispatch, buildClientStore, RootState } from './store';
import { Actions as SyncActions } from './store/sync';
import { Middleware } from '@reduxjs/toolkit';
import { apiFetch } from '../api';

export class ClientSync {
  // This property is set during the build method below, so it's effectively set in the constructor
  // and doesn't need a valid value here.
  private dispatch: AppDispatch = undefined as any;
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private key: string = '';

  private constructor() {
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
    // make sure the socket is listening...
    this.key = (await apiFetch<{key: string}>('/api/socket-keepalive')).key;
    // and then connect to it.
    this.socket.connect();
    //this.dispatch(loadEnvironment());
  }

  handleLocalAction(action: { type: string, payload: any }, state: RootState) {
    console.log('SYNC action', action);
    localStorage.activities = JSON.stringify(state.activities);
    this.socket.emit('reportAction', action,this.socket.id);
  }

  static buildSyncAndStore() {
    const sync = new ClientSync();

    const syncMiddleware: Middleware<{}, RootState> = storeApi => next => (action: {type: string, payload: any, meta?: { sync?: boolean }}) => {
      const result = next(action);
      if (action?.meta?.sync) {
        sync.handleLocalAction(action, storeApi.getState());
      }
      return result;
    }

    const store = buildClientStore([syncMiddleware]);
    sync.dispatch = store.dispatch;
    return { store, sync }
  }
}