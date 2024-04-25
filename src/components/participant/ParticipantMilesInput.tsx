import { Reducer, useEffect, useReducer } from 'react';

import { FormControl, FormControlLabel, Radio, RadioGroup, Stack, TextField, Typography } from '../Material';

enum MilesMode {
  SetTotal = 'set_total',
  AddMiles = 'add_miles',
}

type MilesState = {
  currentMiles: number;
  newMiles: number | string;
  mode: MilesMode;
};

type MilesAction = {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
};

const createAction = (type: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const action = (payload: any) => ({
    type,
    payload,
  });
  action.type = type;
  return action;
};

const updateMiles = createAction('updateMiles');
const updateMode = createAction('updateMode');

const reducer: Reducer<MilesState, MilesAction> = (state: MilesState, action: MilesAction) => {
  switch (action.type) {
    case updateMiles.type:
      return { ...state, newMiles: action.payload };
    case updateMode.type:
      return { ...state, mode: action.payload };
    default:
      return { ...state };
  }
};

export function ParticipantMilesInput({ value, currentMiles, onChange }: { value: number | string; currentMiles: number; onChange?: (n: number | string) => void }) {
  const [state, dispatch] = useReducer<Reducer<MilesState, MilesAction>>(reducer, { currentMiles, mode: MilesMode.SetTotal, newMiles: '' });

  useEffect(() => {
    let totalMiles = Number(state.currentMiles);
    if (state.newMiles !== '') {
      totalMiles = state.mode === MilesMode.SetTotal ? Number(state.newMiles) : totalMiles + Number(state.newMiles);
    }
    onChange?.(totalMiles);
  }, [state, onChange]);

  return (
    <Stack spacing={1}>
      <Typography>You currently have {state.currentMiles} round-trip miles.</Typography>
      <FormControl>
        <RadioGroup row value={state.mode == MilesMode.SetTotal} onChange={(event) => dispatch(updateMode(event.target.value === 'true' ? MilesMode.SetTotal : MilesMode.AddMiles))}>
          <FormControlLabel value="true" control={<Radio size="small" />} label="Change total" />
          <FormControlLabel value="false" control={<Radio size="small" />} label="Add leg" />
        </RadioGroup>
      </FormControl>
      <TextField
        label={state.mode === MilesMode.SetTotal ? 'Round-Trip Miles' : 'Leg Miles'}
        value={state.newMiles}
        type={'number'}
        onChange={(e) => {
          const value = e.target.value;
          dispatch(updateMiles(value === '' ? value : Math.max(0, Number(value))));
        }}
        onKeyDown={(event) => {
          if (event.key.match('-')) event.preventDefault();
        }}
      />
      <Typography>New round-trip miles: {value}</Typography>
    </Stack>
  );
}
