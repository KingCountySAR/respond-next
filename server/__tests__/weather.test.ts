import { describe, expect, it } from 'vitest';
import { NoaaWeather } from '../src/weather';
import { testApp } from './helpers';

const POINTS = 'https://api.weather.gov/points/47.4672,-121.6754';
const HOURLY = 'https://api.weather.gov/gridpoints/SEW/150,50/forecast/hourly';

/** NOAA, answering from a table of URLs; anything else is a 500. */
function fakeNoaa(responses: Record<string, unknown>): typeof fetch {
  return (async (url: string | URL) => {
    const body = responses[String(url)];
    return body === undefined ? new Response('nope', { status: 500 }) : Response.json(body);
  }) as typeof fetch;
}

const period = { name: 'This Afternoon', temperature: 41, temperatureUnit: 'F', relativeHumidity: { value: 88 }, windSpeed: '5 mph', shortForecast: 'Light Rain', icon: 'https://example/rain' };

describe('NOAA weather', () => {
  it('reads the first hourly period', async () => {
    const weather = new NoaaWeather(fakeNoaa({ [POINTS]: { properties: { forecastHourly: HOURLY } }, [HOURLY]: { properties: { periods: [period] } } }));
    expect(await weather.forecast(47.4672, -121.6754)).toEqual({
      ok: true,
      report: {
        forecastUrl: 'https://forecast.weather.gov/MapClick.php?lat=47.4672&lon=-121.6754',
        period: { name: 'This Afternoon', temperature: 41, temperatureUnit: 'F', humidity: 88, windSpeed: '5 mph', shortForecast: 'Light Rain', icon: 'https://example/rain' },
      },
    });
  });

  it('reports what went wrong', async () => {
    expect(await new NoaaWeather(fakeNoaa({})).forecast(47.4672, -121.6754)).toEqual({ ok: false, error: 'NOAA points service error (500)' });
    const noHourly = new NoaaWeather(fakeNoaa({ [POINTS]: { properties: {} } }));
    expect(await noHourly.forecast(47.4672, -121.6754)).toEqual({ ok: false, error: 'NOAA did not provide an hourly forecast.' });
    const incomplete = new NoaaWeather(fakeNoaa({ [POINTS]: { properties: { forecastHourly: HOURLY } }, [HOURLY]: { properties: { periods: [{ name: 'Now' }] } } }));
    expect(await incomplete.forecast(47.4672, -121.6754)).toEqual({ ok: false, error: 'NOAA returned an incomplete forecast.' });
  });
});

describe('weather route', () => {
  const weather = new NoaaWeather(fakeNoaa({ [POINTS]: { properties: { forecastHourly: HOURLY } }, [HOURLY]: { properties: { periods: [period] } } }));
  const crt = testApp({ weather }).client();

  it('returns the forecast, or 400 for bad coordinates and 502 when NOAA fails', async () => {
    await crt.signIn('bo.okafor@crt.example.org');
    const res = await crt.request('/api/weather?lat=47.4672&lon=-121.6754');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { period: { temperature: number } }).period.temperature).toBe(41);
    expect((await crt.request('/api/weather?lat=91&lon=0')).status).toBe(400);
    expect((await crt.request('/api/weather?lat=x&lon=0')).status).toBe(400);
    const failed = await crt.request('/api/weather?lat=10&lon=10');
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: 'NOAA points service error (500)' });
  });
});
