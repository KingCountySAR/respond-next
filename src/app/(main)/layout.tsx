'use client';

import * as React from 'react';

import LoginPanel from '@respond/components/LoginPanel';
import { useAppSelector } from '@respond/lib/client/store';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { userInfo } = useAppSelector((state) => state.auth);
  if (!userInfo) {
    children = <LoginPanel />;
  }

  return children;
}
