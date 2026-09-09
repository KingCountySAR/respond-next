import { Hono } from 'hono';

export const weatherRoutes = new Hono();

type NoaaPointResponse = {
  properties?: {
    forecastHourly?: string;
  };
};

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

const NOAA_USER_AGENT = 'KCesar Respond weather dashboard (https://github.com/KingCountySAR/respond-next)';

weatherRoutes.get('/weather', async (c) => {
  const latitude = Number(c.req.query('lat'));
  const longitude = Number(c.req.query('lon'));

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return c.json({ error: 'Invalid coordinates.' }, 400);
  }

  try {
    const headers = { Accept: 'application/geo+json', 'User-Agent': NOAA_USER_AGENT };
    const pointsResponse = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, { headers });

    if (!pointsResponse.ok) {
      return c.json({ error: `NOAA points service error (${pointsResponse.status})` }, 502);
    }

    const points = (await pointsResponse.json()) as NoaaPointResponse;
    const forecastUrl = points.properties?.forecastHourly;
    if (!forecastUrl) {
      return c.json({ error: 'NOAA did not provide an hourly forecast.' }, 502);
    }

    const forecastResponse = await fetch(forecastUrl, { headers });
    if (!forecastResponse.ok) {
      return c.json({ error: `NOAA forecast service error (${forecastResponse.status})` }, 502);
    }

    const forecast = (await forecastResponse.json()) as NoaaForecastResponse;
    const period = forecast.properties?.periods?.[0];
    if (period?.temperature == null || !period.temperatureUnit || !period.shortForecast) {
      return c.json({ error: 'NOAA returned an incomplete forecast.' }, 502);
    }

    return c.json({
      forecastUrl: `https://forecast.weather.gov/MapClick.php?lat=${latitude}&lon=${longitude}`,
      period: {
        name: period.name ?? 'Current forecast',
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit,
        humidity: period.relativeHumidity?.value ?? null,
        windSpeed: period.windSpeed ?? 'Unavailable',
        shortForecast: period.shortForecast,
        icon: period.icon ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to load NOAA weather', error);
    return c.json({ error: 'Failed to load weather from NOAA.' }, 502);
  }
});
