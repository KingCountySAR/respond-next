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
