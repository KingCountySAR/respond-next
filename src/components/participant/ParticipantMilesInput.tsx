import { Reducer, useEffect, useReducer, useState } from 'react';

import { Button, FormControl, FormControlLabel, Radio, RadioGroup, Stack, TextField, Typography } from '../Material';

type ParticipantMilesState = {
  initialMiles: number;
  miles: number;
};

type MilesAction = {
  type: 'set_total' | 'add_miles';
  miles: number;
};

const reducer: Reducer<ParticipantMilesState, MilesAction> = (state: ParticipantMilesState, action: MilesAction) => {
  const hasMiles = action.miles > 0;
  switch (action.type) {
    case 'set_total': {
      return { ...state, miles: hasMiles ? action.miles : state.initialMiles };
    }
    case 'add_miles': {
      return { ...state, miles: state.initialMiles + (hasMiles ? action.miles : 0) };
    }
  }
};

export function ParticipantMileageInput({ currentMiles, submittable, onChange, onSubmit, onCancel }: { currentMiles: number; submittable?: boolean; onChange?: (miles: number) => void; onCancel?: () => void; onSubmit?: (miles: number) => void }) {
  const [state, dispatch] = useReducer<Reducer<ParticipantMilesState, MilesAction>>(reducer, { initialMiles: currentMiles, miles: 0 });
  const [value, setValue] = useState(0);
  const [isTotalMiles, setIsTotalMiles] = useState<boolean>(true);

  useEffect(() => {
    dispatch({ type: isTotalMiles ? 'set_total' : 'add_miles', miles: value });
  }, [value, isTotalMiles]);

  useEffect(() => {
    if (onChange) onChange(state.miles);
  }, [state, onChange]);

  const handleSubmit = () => {
    if (onSubmit) onSubmit(state.miles);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  return (
    <Stack spacing={1}>
      <Typography>You currently have {currentMiles} round-trip miles.</Typography>
      <FormControl>
        <RadioGroup row value={isTotalMiles} onChange={(event) => setIsTotalMiles(event.target.value === 'true')}>
          <FormControlLabel value="true" control={<Radio size="small" />} label="Change total" />
          <FormControlLabel value="false" control={<Radio size="small" />} label="Add leg" />
        </RadioGroup>
      </FormControl>
      <TextField
        inputMode="numeric"
        onChange={(event) => {
          setValue(event.target.value !== undefined ? parseInt(event.target.value) : 0);
        }}
        type="number"
        variant="outlined"
        label={isTotalMiles ? 'Round-Trip Miles' : 'Leg Miles'}
      />
      <Typography>New round-trip miles: {state.miles}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent={'right'} spacing={2}>
        {submittable && (
          <>
            <Button variant={'outlined'} onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant={'contained'} onClick={handleSubmit}>
              Update
            </Button>
          </>
        )}
      </Stack>
    </Stack>
  );
}
