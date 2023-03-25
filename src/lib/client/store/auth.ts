import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { UserInfo } from '@respond/types/userInfo';

export interface AuthState {
  userInfo?: UserInfo,
}

let initialState: AuthState = {};

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      delete localStorage.userAuth;
      return {};
    } catch (err: unknown) {
      rejectWithValue(err);
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    set: (state: AuthState, action: PayloadAction<AuthState>) => {
      Object.assign(state, action.payload);
    }
  },
  extraReducers: (builder) => {
      builder
    .addCase(logoutUser.fulfilled, state => {
      state.userInfo = undefined
    });
  }
});

export default authSlice.reducer;

export const AuthActions = {
  ...authSlice.actions,
  logout: logoutUser,
}