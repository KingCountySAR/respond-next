import { Reducer, useEffect, useReducer, useState } from 'react';

import { FormControl, FormControlLabel, Radio, RadioGroup, Stack, TextField, Typography } from './Material';

type ParticipantMilesState = {
  initialMiles: number;
  miles: number;
};

type MilesAction = {
  type: 'set_total' | 'add_miles';
  miles: number;
};

const reducer: Reducer<ParticipantMilesState, MilesAction> = (state: ParticipantMilesState, action: MilesAction) => {
  switch (action.type) {
    case 'set_total': {
      return { ...state, miles: action.miles };
    }
    case 'add_miles': {
      return { ...state, miles: state.initialMiles + action.miles };
    }
  }
};

export function ParticipantMileageInput({ currentMiles, onChange }: { currentMiles: number; onChange: (miles: number) => void }) {
  const [state, dispatch] = useReducer<Reducer<ParticipantMilesState, MilesAction>>(reducer, { initialMiles: currentMiles, miles: 0 });
  const [value, setValue] = useState(currentMiles);
  const [isTotalMiles, setIsTotalMiles] = useState<boolean>(true);

  useEffect(() => {
    dispatch({ type: isTotalMiles ? 'set_total' : 'add_miles', miles: value });
  }, [value, isTotalMiles]);

  useEffect(() => {
    onChange(state.miles);
  }, [state, onChange]);

  return (
    <Stack spacing={1}>
      <Typography>You currently have {currentMiles} round-trip miles.</Typography>
      <FormControl>
        <RadioGroup row value={isTotalMiles} onChange={(event) => setIsTotalMiles(event.target.value === 'true')}>
          <FormControlLabel value="true" control={<Radio size="small" />} label="Change total" />
          <FormControlLabel value="false" control={<Radio size="small" />} label="Add leg" />
        </RadioGroup>
      </FormControl>
      <TextField value={value} onChange={(event) => setValue(event.target.value ? parseInt(event.target.value) : 0)} type="number" variant="outlined" label={isTotalMiles ? 'Round-Trip Miles' : 'Leg Miles'} />
      <Typography>New round-trip miles: {state.miles}</Typography>
    </Stack>
  );
}
