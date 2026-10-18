/** The current forecast for a point (`GET /api/weather?lat=&lon=`), from NOAA. The legacy shape. */
export interface WeatherReport {
  /** NOAA's forecast page for the point, for people to open. */
  forecastUrl: string;
  period: { name: string; temperature: number; temperatureUnit: string; humidity: number | null; windSpeed: string; shortForecast: string; icon: string | null };
}

export const isValidPoint = (lat: number, lon: number): boolean => Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;
