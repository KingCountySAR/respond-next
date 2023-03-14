'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { ReactNode } from 'react';

export default function ClientProviders({ googleClient, children }: { googleClient: string, children: ReactNode}) {
  return (
    <GoogleOAuthProvider clientId={googleClient}>
      {children}
    </GoogleOAuthProvider>
  )
}