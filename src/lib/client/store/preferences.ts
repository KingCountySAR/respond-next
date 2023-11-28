import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { MobilePageId } from '@respond/components/activities/MobileActivityPage';

export interface PerferencesState {
  defaultMobileView: MobilePageId;
}

let initialState: PerferencesState = {
  defaultMobileView: MobilePageId.Briefing,
};

if (localStorage?.preferences) {
  initialState = Object.assign(initialState, JSON.parse(localStorage.preferences));
}

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    update: (state: PerferencesState, action: PayloadAction<PerferencesState>) => {
      const newState = Object.assign(state, action.payload);
      localStorage.preferences = JSON.stringify(newState);
      return newState;
    },
  },
});

export default preferencesSlice.reducer;

export const PreferenceActions = {
  ...preferencesSlice.actions,
};
