import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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

const initialState: PerferencesState = {
  defaultMobileView: MobilePageId.Briefing,
  navigationApp: NavigationApp.Google,
  etaIncrement: 5,
  etaPreset1: 15,
  etaPreset2: 30,
  etaPreset3: 60,
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    update: (state: PerferencesState, action: PayloadAction<PerferencesState>) => {
      return Object.assign(state, action.payload);
    },
    reload: (state: PerferencesState, action: PayloadAction<PerferencesState>) => {
      return Object.assign(state, action.payload);
    },
  },
});

export default preferencesSlice.reducer;

export const PreferenceActions = {
  ...preferencesSlice.actions,
};
