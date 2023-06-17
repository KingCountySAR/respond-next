import { createSlice, PayloadAction } from "@reduxjs/toolkit";


export interface ConfigStore {
  dev: {
    noExternalNetwork: boolean;
  }
  organization: {
    title: string;
    shortTitle: string;
  }
}

const slice = createSlice({
  name: 'config',
  initialState: {
    dev: { noExternalNetwork: false, buildId: '' },
    organization: { title: '', shortTitle: ''}
  },
  reducers: {
    set: (state, action: PayloadAction<ConfigStore>) => {
      Object.assign(state, action.payload);
    }
  },
});

export default slice.reducer;

export const ConfigActions = slice.actions;