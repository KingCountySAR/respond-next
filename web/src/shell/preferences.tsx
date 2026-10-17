/** The legacy app's per-device preferences, kept in localStorage under the same key. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export enum MobilePageId {
  Briefing = 'Briefing',
  Roster = 'Roster',
  Manage = 'Manage',
}

export enum NavigationApp {
  Google = 'Google',
  Apple = 'Apple',
  Waze = 'Waze',
}

export interface Preferences {
  defaultMobileView: MobilePageId;
  navigationApp: NavigationApp;
  /** Minutes the ETA +/- buttons move it by. */
  etaIncrement: number;
  /** The three "ETA in N minutes" buttons. */
  etaPreset1: number;
  etaPreset2: number;
  etaPreset3: number;
}

export const defaultPreferences: Preferences = {
  defaultMobileView: MobilePageId.Briefing,
  navigationApp: NavigationApp.Google,
  etaIncrement: 5,
  etaPreset1: 15,
  etaPreset2: 30,
  etaPreset3: 60,
};

const STORAGE_KEY = 'preferences';

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultPreferences, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    // Unreadable or blocked storage: fall back to the defaults.
  }
  return defaultPreferences;
}

const PreferencesContext = createContext<{ preferences: Preferences; setPreferences(p: Preferences): void } | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Private windows can refuse storage; the preferences then last until reload.
    }
  }, [preferences]);
  const value = useMemo(() => ({ preferences, setPreferences }), [preferences]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx.preferences;
}

export function useSetPreferences(): (p: Preferences) => void {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('useSetPreferences must be used within PreferencesProvider');
  return ctx.setPreferences;
}
