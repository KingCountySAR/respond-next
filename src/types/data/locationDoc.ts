export const LOCATION_COLLECTION = 'locations';

export interface LocationDoc {
  id: string;
  name: string;
  lat?: string;
  lon?: string;
  address?: string;
}
