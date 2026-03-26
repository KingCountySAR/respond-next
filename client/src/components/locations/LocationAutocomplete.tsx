import { Location } from '@app/shared/api';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useLocationsContext } from '@respond/store/locationsStore';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

type TextFieldVariant = 'filled' | 'outlined' | 'standard';



export const LocationAutocomplete = observer(({ required, value, variant = 'filled', onChange }: { required?: boolean; value?: Location; variant?: TextFieldVariant; onChange: (location: Location | null) => void }) => {
  const locationsStore = useLocationsContext();

  const [selected, setSelected] = useState<Location | null>(value ?? null);
  //const [options, setOptions] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  //const loadingLocations = isOpen && options.length === 0;

  const options = [ ...locationsStore.locations ];
  if (value && !options.some(l => l.id === value.id)) {
    options.unshift(value);
  }

  useEffect(() => {
    locationsStore.load();
  }, [ locationsStore ]);

  // useEffect(() => {
  //   const locationOptions = [...locations];
  //   if (value && !locations.some((l) => l.id === value.id)) {
  //     locationOptions.push(value);
  //   }
  //   (async () => {
  //     setSelected(value?.title ? value : null);
  //     setOptions(locationOptions.sort((a, b) => (a.title >= b.title ? 1 : -1)));
  //   })();
  // }, [locations, value]);

  return new Date().getTime() < 1 ?
    <div>{JSON.stringify(options)}</div>
    :
    <Autocomplete
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      disablePortal
      options={options}
      onChange={(_event, value) => {
        setSelected(value);
        onChange(value);
      }}
      isOptionEqualToValue={(option, value) => option.id === value?.id}
      getOptionLabel={(option) => option.title}
      value={selected}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.title}>
            {option.title}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant={variant}
          label="Location"
          required={required}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {locationsStore.loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }
          }}
        />
      )}
    />;
});

