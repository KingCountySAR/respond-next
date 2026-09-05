import { createAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { PresencePing, PresenceSnapshot, PresenceUpdate } from '@respond/shared/types/syncSocket';

export interface PresenceState {
  // topic -> editorId -> that editor's latest presence update.
  byTopic: Record<string, Record<string, PresenceUpdate>>;
}

const initialState: PresenceState = { byTopic: {} };

// Intent to publish an ephemeral "I'm here" signal for a topic. ClientSync
// forwards this to the socket; nothing else reduces it.
export const presencePingSent = createAction<PresencePing>('presence/presencePingSent');

// Intent to ask the server who's already present for a topic. ClientSync
// forwards this to the socket; the reply is applied via presenceSnapshotReceived.
export const presenceSubscribeRequested = createAction<{ topic: string }>('presence/presenceSubscribeRequested');

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    presenceUpdateReceived: (state, action: PayloadAction<PresenceUpdate>) => {
      const { topic, editorId } = action.payload;
      (state.byTopic[topic] ??= {})[editorId] = action.payload;
    },
    presenceSnapshotReceived: (state, action: PayloadAction<PresenceSnapshot>) => {
      const byEditor: Record<string, PresenceUpdate> = {};
      for (const entry of action.payload.entries) {
        byEditor[entry.editorId] = entry;
      }
      state.byTopic[action.payload.topic] = byEditor;
    },
  },
});

export default presenceSlice.reducer;
export const PresenceActions = { ...presenceSlice.actions, presencePingSent, presenceSubscribeRequested };
