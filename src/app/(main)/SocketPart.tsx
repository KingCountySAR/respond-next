'use client';
import { useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents } from '@respond/pages/api/socket';

let socket: Socket<ServerToClientEvents, ClientToServerEvents>;

export default function SocketPart() {
  useEffect(() => socketInitializer(), [])

  const socketInitializer = () => {
    console.log('building socket');
    socket = io('/', {
      path: '/api/socket',
      autoConnect: true,
      transports: ['websocket', 'polling'], /*process.env.NODE_ENV === 'production' ? ['websocket', 'polling'] : ['polling'],*/
    });
    socket.on('connect', () => console.log('socket connected'));
    socket.on('welcome', (data, respondingTo) => console.log('got welcome', data, respondingTo));
    socket.on('disconnect', () => console.log('socket disconnected'));
  }

  return null;
}