'use client';

import { useSession } from 'next-auth/react';

export default function AppBar() {
  const { data: session, status } = useSession();

  return (<>
    <div>Status: {status}</div>
    <div>data: { JSON.stringify(session ?? {})}</div>
  </>)
}