import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface SyncState {
  id?: string;
  connected: boolean;
}

const initialState: SyncState = {
  connected: false,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    connected: (state, action: PayloadAction<{id: string}>) => {
      state.id = action.payload.id;
      state.connected = true;
    },
    disconnected: (state) => {
      state.id = undefined;
      state.connected = false;
    },
  },
});

export default syncSlice.reducer;
export const Actions = syncSlice.actions;