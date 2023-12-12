import { v4 as uuid } from 'uuid';

export interface Location {
  id: string;
  title: string;
  lat?: string;
  lon?: string;
  address?: string;
}

export const createNewLocation = (title: string, lat?: string, lon?: string, address?: string) => {
  return {
    id: uuid(),
    title: title,
    lat: lat ?? '',
    lon: lon ?? '',
    address: address ?? '',
  };
};
