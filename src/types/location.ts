import { v4 as uuid } from 'uuid';

import { pickSafely } from '@respond/lib/pickSafely';

export interface Location {
  id: string;
  title: string;
  lat?: string;
  lon?: string;
  address?: string;
  directions?: string;
  description?: string;
  active?: boolean;
}

export const createNewLocation = (): Location => {
  return {
    id: uuid(),
    title: '',
    active: true,
  };
};

export const createNewTemporaryLocation = (): Location => {
  return {
    id: uuid(),
    title: '',
    active: false,
  };
};

export const pickLocationProperties = pickSafely<Partial<Location>>(['id', 'title', 'lat', 'lon', 'address', 'description', 'directions', 'active']);
