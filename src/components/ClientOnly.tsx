'use client';

import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import React, { ReactNode, useEffect, useState } from 'react';

export default function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  return mounted ? <LocalizationProvider dateAdapter={AdapterDateFns}>{children}</LocalizationProvider> : null;
}
