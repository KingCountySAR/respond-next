import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { UserInfo } from '@respond/types/userInfo';

export interface AuthState {
  userInfo?: UserInfo,
}

let initialState: AuthState = {
  
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    set: (state: AuthState, action: PayloadAction<AuthState>) => {
      Object.assign(state, action.payload);
    }
  },
});

export default authSlice.reducer;

export const AuthActions = {
  ...authSlice.actions,
}