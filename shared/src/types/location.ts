import { v4 as uuid } from 'uuid';
export interface Location {
  id: string;
  title: string;
  lat: string;
  lon: string;
  address: string;
  description: string;
  toSaved?: boolean;
  isSaved: boolean;
}

export const createNewLocation = (toSaved?: boolean): Location => {
  const newLocation: Location = {
    id: uuid(),
    title: '',
    lat: '',
    lon: '',
    address: '',
    description: '',
    isSaved: false,
  };
  if (toSaved) newLocation.toSaved = true;
  return newLocation;
};
