import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { MobilePageId } from '@respond/components/activities/MobileActivityPage';

export interface PerferencesState {
  defaultMobileView: MobilePageId;
}

let initialState: PerferencesState = {
  defaultMobileView: MobilePageId.Briefing,
};

if (localStorage?.preferences) {
  try {
    initialState = Object.assign(initialState, JSON.parse(localStorage.preferences));
  } catch (error) {
    console.error('saved preferences could not be parsed', error);
  }
}

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    update: (state: PerferencesState, action: PayloadAction<PerferencesState>) => {
      return Object.assign(state, action.payload);
    },
  },
});

export default preferencesSlice.reducer;

export const PreferenceActions = {
  ...preferencesSlice.actions,
};
