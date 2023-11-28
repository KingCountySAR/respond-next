import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { MobilePageId } from '@respond/components/activities/MobileActivityPage';

export interface PerferencesState {
  defaultMobileView: MobilePageId;
}

const initialState: PerferencesState = {
  defaultMobileView: MobilePageId.Briefing,
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
