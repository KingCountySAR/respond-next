import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get('lat'));
  const longitude = Number(request.nextUrl.searchParams.get('lon'));

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 });
  }

  try {
    const headers = { Accept: 'application/geo+json', 'User-Agent': NOAA_USER_AGENT };
    const pointsResponse = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, { headers, cache: 'no-store' });

    if (!pointsResponse.ok) {
      return NextResponse.json({ error: `NOAA points service error (${pointsResponse.status})` }, { status: 502 });
    }

    const points = (await pointsResponse.json()) as NoaaPointResponse;
    const forecastUrl = points.properties?.forecastHourly;
    if (!forecastUrl) {
      return NextResponse.json({ error: 'NOAA did not provide an hourly forecast.' }, { status: 502 });
    }

    const forecastResponse = await fetch(forecastUrl, { headers, cache: 'no-store' });
    if (!forecastResponse.ok) {
      return NextResponse.json({ error: `NOAA forecast service error (${forecastResponse.status})` }, { status: 502 });
    }

    const forecast = (await forecastResponse.json()) as NoaaForecastResponse;
    const period = forecast.properties?.periods?.[0];
    if (period?.temperature == null || !period.temperatureUnit || !period.shortForecast) {
      return NextResponse.json({ error: 'NOAA returned an incomplete forecast.' }, { status: 502 });
    }

    return NextResponse.json({
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
    return NextResponse.json({ error: 'Failed to load weather from NOAA.' }, { status: 502 });
  }
}
