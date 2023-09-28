import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { MyOrganization } from '@respond/types/organization';

import { logoutUser } from './auth';

import { RootState } from '.';

export interface OrganizationState {
  mine?: MyOrganization;
}

const initialState: OrganizationState = {};

const slice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    set: (state, action: PayloadAction<OrganizationState>) => {
      //merge(state, action.payload);
      console.log('org set reducer', action.payload);
      Object.assign(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.mine = undefined;
    });
  },
});

export default slice.reducer;

export const OrgActions = slice.actions;

export const canCreateMissions = createSelector(
  (state: RootState) => state.organization.mine,
  (org): boolean => {
    if (!org) {
      return false;
    }
    return org.canCreateMissions || !!org.partners.find((f) => f.canCreateMissions);
  },
);

export const canCreateEvents = createSelector(
  (state: RootState) => state.organization.mine,
  (org): boolean => {
    if (!org) {
      return false;
    }
    return org.canCreateEvents || !!org.partners.find((f) => f.canCreateEvents);
  },
);
