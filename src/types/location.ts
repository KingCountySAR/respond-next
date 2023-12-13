import { v4 as uuid } from 'uuid';

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

export const createNewLocation = (title: string, lat?: string, lon?: string, address?: string) => {
  return {
    id: uuid(),
    title: title,
    lat: lat ?? '',
    lon: lon ?? '',
    address: address ?? '',
    directions: '',
    description: '',
    active: true,
  };
};
