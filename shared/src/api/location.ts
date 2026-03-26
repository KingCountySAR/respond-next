import { ApiResult } from './common.js';

export interface Location {
  id: string;
  title: string;
  lat: string;
  lon: string;
  address: string;
  description: string;
  isSaved: boolean;
}

export type LocationsResult = ApiResult<Location[]>;

export const createNewLocation = (): Location => {
  const newLocation: Location = {
    id: crypto.randomUUID(),
    title: '',
    lat: '',
    lon: '',
    address: '',
    description: '',
    isSaved: false,
  };
  return newLocation;
};
