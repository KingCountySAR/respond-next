import { MobilePageId } from '@respond/components/activities/MobileActivityPage';

export enum NavigationApp {
  Google = 'Google',
  Apple = 'Apple',
  Waze = 'Waze',
}

export interface PerferencesState {
  defaultMobileView: MobilePageId;
  navigationApp: NavigationApp;
  etaIncrement: number;
  etaPreset1: number;
  etaPreset2: number;
  etaPreset3: number;
}

export const defaultPreferences: PerferencesState = {
  defaultMobileView: MobilePageId.Briefing,
  navigationApp: NavigationApp.Google,
  etaIncrement: 5,
  etaPreset1: 15,
  etaPreset2: 30,
  etaPreset3: 60,
};

export default PerferencesState;
