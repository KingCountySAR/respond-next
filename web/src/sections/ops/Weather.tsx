import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, IconButton, Link, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { isValidPoint, type WeatherReport } from '@sync/domain';
import { useApi } from '../../shell/api';
import { DashboardDividedSection } from './parts';

/** The forecast is read again this often, quietly, while the dashboard is open. */
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const weatherIcon = (condition: string): string => {
  const c = condition.toLowerCase();
  if (c.includes('thunder')) return '⛈️';
  if (c.includes('snow') || c.includes('sleet')) return '❄️';
  if (c.includes('rain') || c.includes('shower')) return '🌧️';
  if (c.includes('smoke')) return '💨';
  if (c.includes('fog')) return '🌫️';
  if (c.includes('cloud')) return '⛅';
  if (c.includes('sun') || c.includes('clear')) return '☀️';
  return '🌡️';
};

/** NOAA's current forecast for the point, linking to NOAA's page. */
function DashboardWeather({ lat, lon, variant }: { lat: number; lon: number; variant: 'standard' | 'compact' }) {
  const api = useApi();
  const [report, setReport] = useState<WeatherReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the refresh button, to read it again now.
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!isValidPoint(lat, lon)) {
      setError('Invalid coordinates provided.');
      setLoading(false);
      return;
    }
    let live = true;
    // In the background (on the interval), what's shown stays until the new forecast arrives.
    const load = (background: boolean) => {
      if (!background) setLoading(true);
      api
        .weather(lat, lon)
        .then((r) => {
          if (!live) return;
          setReport(r);
          setError(null);
        })
        .catch((err: unknown) => live && setError(err instanceof Error ? err.message : 'Failed to load weather'))
        .finally(() => live && setLoading(false));
    };
    setError(null);
    load(false);
    const interval = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [api, lat, lon, reloads]);

  if (loading) return <Box>Loading weather...</Box>;
  if (error || !report)
    return (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>⚠️ {error || 'No weather data available!'}</Box>
        <IconButton size="small" aria-label="Refresh weather" onClick={() => setReloads((n) => n + 1)}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Stack>
    );

  const { period } = report;
  const unit = `°${period.temperatureUnit}`;
  const details = `${period.shortForecast} • Wind: ${period.windSpeed} • Humidity: ${period.humidity ?? 'Unavailable'}%`;
  return (
    <Link color="textPrimary" href={report.forecastUrl} target="_blank" rel="noopener noreferrer" sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'none' } }}>
      {variant === 'standard' ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography component="span" sx={{ fontSize: 28 }}>
            {weatherIcon(period.shortForecast)}
          </Typography>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {period.name}
            </Typography>
            <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
              {period.temperature}
              {unit}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {details}
            </Typography>
          </Box>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            {period.temperature}
            {unit}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {details}
          </Typography>
        </Stack>
      )}
    </Link>
  );
}

export function DashboardWeatherDividedSection({ lat, lon }: { lat: number; lon: number }) {
  return (
    <DashboardDividedSection title="Weather">
      <DashboardWeather lat={lat} lon={lon} variant="compact" />
    </DashboardDividedSection>
  );
}

export function DashboardWeatherTile({ lat, lon }: { lat: number; lon: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
      <DashboardWeather lat={lat} lon={lon} variant="standard" />
    </Paper>
  );
}
