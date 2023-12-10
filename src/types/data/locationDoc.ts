export const LOCATION_COLLECTION = 'locations';

export interface LocationDoc {
  _id: string;
  id: string;
  title: string;
  lat?: string;
  lon?: string;
  address?: string;
}
