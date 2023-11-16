import { Unstable_NumberInput as BaseNumberInput, NumberInputProps as BaseNumberInputProps } from '@mui/base';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { styled } from '@mui/system';
import { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';

export interface NumberInputProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> {
  field: ControllerRenderProps<TFieldValues, TName>;
  props?: BaseNumberInputProps;
}

/**
 * @description Styled wrapper around MUI NumberInput component that works well with react-hook-form.
 */
function NumberInput<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({ field, props }: NumberInputProps<TFieldValues, TName>) {
  return (
    <BaseNumberInput
      {...props}
      {...field}
      onChange={(e, v) => {
        // NumberInput handles all input field events and normalizes them into a single onChange
        // event with the source event and the new value.
        //
        // react-hook-form expects the onChange event to come directly from the input field
        // and thus be structured a certain way.
        //
        // To make react-hook-form and NumberInput play nicely with each other, we can pass the value directly
        // to react-hook-form's onChange event. Since it is a bare value, react-hook-form will
        // use it directly.
        //
        // Here is the source where react-hook-form either pulls the value out of the event or,
        // failing that, uses the event oject directly:
        // https://github.com/react-hook-form/react-hook-form/blob/c7b7eacb00cd11fe8fd075c958589b5b00b2c49d/src/logic/getEventValue.ts
        field.onChange(v);

        // Pass on the event to the caller so they can react to it for other reasons if needed.
        if (props?.onChange) {
          props.onChange(e, v);
        }
      }}
      slots={{
        root: StyledInputRoot,
        input: StyledInput,
        incrementButton: StyledButton,
        decrementButton: StyledButton,
      }}
      slotProps={{
        ...props?.slotProps,
        incrementButton: {
          children: <AddIcon fontSize="small" />,
          className: 'increment',

          // Spread the provided props after visual changes to
          // allow for the caller to override.
          ...props?.slotProps?.incrementButton,

          // Buttons default to type "submit", which will submit the form.
          // Force type "button" so it doesn't submit the form.
          type: 'button',
        },
        decrementButton: {
          children: <RemoveIcon fontSize="small" />,
          className: 'decrement',

          // Spread the provided props after visual changes to
          // allow for the caller to override.
          ...props?.slotProps?.decrementButton,

          // Buttons default to type "submit", which will submit the form.
          // Force type "button" so it doesn't submit the form.
          type: 'button',
        },
        input: {
          ...props?.slotProps?.input,
          inputMode: 'numeric', // Display appropriate mobile keyboard
        },
      }}
    />
  );
}

export default NumberInput;

// Styles taken from NumberInput examples: https://mui.com/base-ui/react-number-input/
const blue = {
  100: '#daecff',
  200: '#b6daff',
  300: '#66b2ff',
  400: '#3399ff',
  500: '#007fff',
  600: '#0072e5',
  700: '#0059B2',
  800: '#004c99',
};

const grey = {
  50: '#F3F6F9',
  100: '#E5EAF2',
  200: '#DAE2ED',
  300: '#C7D0DD',
  400: '#B0B8C4',
  500: '#9DA8B7',
  600: '#6B7A90',
  700: '#434D5B',
  800: '#303740',
  900: '#1C2025',
};

const StyledInputRoot = styled('div')(
  ({ theme }) => `
  font-family: IBM Plex Sans, sans-serif;
  font-weight: 400;
  color: ${theme.palette.mode === 'dark' ? grey[300] : grey[500]};
  display: flex;
  flex-flow: row nowrap;
  justify-content: center;
  align-items: center;
`,
);

const StyledInput = styled('input')(
  ({ theme }) => `
  font-size: 0.875rem;
  font-family: inherit;
  font-weight: 400;
  line-height: 1.375;
  color: ${theme.palette.mode === 'dark' ? grey[300] : grey[900]};
  background: ${theme.palette.mode === 'dark' ? grey[900] : '#fff'};
  border: 1px solid ${theme.palette.mode === 'dark' ? grey[700] : grey[200]};
  box-shadow: 0px 2px 4px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0, 0.5)' : 'rgba(0,0,0, 0.05)'};
  border-radius: 8px;
  margin: 0 8px;
  padding: 10px 12px;
  outline: 0;
  min-width: 0;
  width: 4rem;
  text-align: center;

  &:hover {
    border-color: ${blue[400]};
  }

  &:focus {
    border-color: ${blue[400]};
    box-shadow: 0 0 0 3px ${theme.palette.mode === 'dark' ? blue[700] : blue[200]};
  }

  &:focus-visible {
    outline: 0;
  }
`,
);

const StyledButton = styled('button')(
  ({ theme }) => `
  font-family: IBM Plex Sans, sans-serif;
  font-size: 0.875rem;
  box-sizing: border-box;
  line-height: 1.5;
  border: 1px solid;
  border-radius: 999px;
  border-color: ${theme.palette.mode === 'dark' ? grey[800] : grey[200]};
  background: ${theme.palette.mode === 'dark' ? grey[900] : grey[50]};
  color: ${theme.palette.mode === 'dark' ? grey[200] : grey[900]};
  width: 32px;
  height: 32px;
  display: flex;
  flex-flow: row nowrap;
  justify-content: center;
  align-items: center;
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 120ms;

  &:hover:enabled {
    cursor: pointer;
    background: ${theme.palette.mode === 'dark' ? blue[700] : blue[500]};
    border-color: ${theme.palette.mode === 'dark' ? blue[500] : blue[400]};
    color: ${grey[50]};
  }

  &:focus-visible {
    outline: 0;
  }

  &.increment {
    order: 1;
  }
`,
);
