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
}

const initialState: PerferencesState = {
  defaultMobileView: MobilePageId.Briefing,
  navigationApp: NavigationApp.Google,
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
