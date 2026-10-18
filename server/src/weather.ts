/** The current NOAA forecast for a point, for the ops dashboard. A port of the legacy weather route. */
import type { WeatherReport } from '@sync/domain';

/** A forecast, or an error to show in its place. */
export type WeatherResult = { ok: true; report: WeatherReport } | { ok: false; error: string };

export interface WeatherSource {
  forecast(lat: number, lon: number): Promise<WeatherResult>;
}

type NoaaPointResponse = { properties?: { forecastHourly?: string } };

type NoaaForecastResponse = {
  properties?: {
    periods?: Array<{
      temperature?: number;
      temperatureUnit?: string;
      relativeHumidity?: { value?: number | null };
      windSpeed?: string;
      shortForecast?: string;
      icon?: string;
      name?: string;
    }>;
  };
};

const NOAA_USER_AGENT = 'Mission Sync weather dashboard (https://github.com/KingCountySAR)';

/** NOAA's points API, then its hourly forecast; the first period is the current one. */
export class NoaaWeather implements WeatherSource {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async forecast(lat: number, lon: number): Promise<WeatherResult> {
    try {
      const headers = { Accept: 'application/geo+json', 'User-Agent': NOAA_USER_AGENT };
      const pointsResponse = await this.fetchImpl(`https://api.weather.gov/points/${lat},${lon}`, { headers });
      if (!pointsResponse.ok) return { ok: false, error: `NOAA points service error (${pointsResponse.status})` };

      const points = (await pointsResponse.json()) as NoaaPointResponse;
      const forecastUrl = points.properties?.forecastHourly;
      if (!forecastUrl) return { ok: false, error: 'NOAA did not provide an hourly forecast.' };

      const forecastResponse = await this.fetchImpl(forecastUrl, { headers });
      if (!forecastResponse.ok) return { ok: false, error: `NOAA forecast service error (${forecastResponse.status})` };

      const forecast = (await forecastResponse.json()) as NoaaForecastResponse;
      const period = forecast.properties?.periods?.[0];
      if (period?.temperature == null || !period.temperatureUnit || !period.shortForecast) return { ok: false, error: 'NOAA returned an incomplete forecast.' };

      return {
        ok: true,
        report: {
          forecastUrl: `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`,
          period: {
            name: period.name || 'Current forecast', // hourly periods come with an empty name
            temperature: period.temperature,
            temperatureUnit: period.temperatureUnit,
            humidity: period.relativeHumidity?.value ?? null,
            windSpeed: period.windSpeed ?? 'Unavailable',
            shortForecast: period.shortForecast,
            icon: period.icon ?? null,
          },
        },
      };
    } catch (error) {
      console.error('Failed to load NOAA weather', error);
      return { ok: false, error: 'Failed to load weather from NOAA.' };
    }
  }
}
