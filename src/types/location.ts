import { v4 as uuid } from 'uuid';

import { pickSafely } from '@respond/lib/pickSafely';

export interface Location {
  id: string;
  title: string;
  lat: string;
  lon: string;
  address: string;
  directions: string;
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
    directions: '',
    description: '',
    isSaved: false,
  };
  if (toSaved) newLocation.toSaved = true;
  return newLocation;
};

export const pickLocationProperties = pickSafely<Partial<Location>>(['id', 'title', 'lat', 'lon', 'address', 'description', 'directions', 'isSaved']);
