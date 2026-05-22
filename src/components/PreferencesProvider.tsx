'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { defaultPreferences, PerferencesState } from '@respond/types/preferences';

type PreferencesContextValue = {
  preferences: PerferencesState;
  setPreferences: (p: PerferencesState) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferencesState] = useState<PerferencesState>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage && localStorage.preferences) {
        return JSON.parse(localStorage.preferences) as PerferencesState;
      }
    } catch (e) {
      console.error('Failed to load saved preferences', e);
    }
    return defaultPreferences;
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.preferences = JSON.stringify(preferences);
      }
    } catch (e) {
      console.error('Failed to persist preferences', e);
    }
  }, [preferences]);

  const value = useMemo(() => ({ preferences, setPreferences: setPreferencesState }), [preferences]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx.preferences;
}

export function useSetPreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('useSetPreferences must be used within PreferencesProvider');
  return ctx.setPreferences;
}

export default PreferencesProvider;
