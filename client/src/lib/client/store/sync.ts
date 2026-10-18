import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SyncState {
  id?: string;
  connected: boolean;
  // True once the server's snapshot has replaced any localStorage-cached state for this connection.
  snapshotReceived: boolean;
}

const initialState: SyncState = {
  connected: false,
  snapshotReceived: false,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    connected: (state, action: PayloadAction<{ id: string }>) => {
      state.id = action.payload.id;
      state.connected = true;
      state.snapshotReceived = false;
    },
    disconnected: (state) => {
      state.id = undefined;
      state.connected = false;
      state.snapshotReceived = false;
    },
    snapshotReceived: (state) => {
      state.snapshotReceived = true;
    },
  },
});

export default syncSlice.reducer;
export const Actions = syncSlice.actions;
