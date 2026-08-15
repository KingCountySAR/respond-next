import { Box, Link, Paper, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { DashboardDividedSection } from './DashboardDividedSection';

interface WeatherProps {
  lat: string | number;
  lon: string | number;
  variant?: 'standard' | 'compact';
}

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: string;
  condition: string;
  periodName: string;
  forecastUrl: string;
  unit: string;
}

const getWeatherIcon = (condition: string): string => {
  const normalizedCondition = condition.toLowerCase();
  if (normalizedCondition.includes('thunder')) return '⛈️';
  if (normalizedCondition.includes('snow') || normalizedCondition.includes('sleet')) return '❄️';
  if (normalizedCondition.includes('rain') || normalizedCondition.includes('shower')) return '🌧️';
  if (normalizedCondition.includes('smoke')) return '💨';
  if (normalizedCondition.includes('fog')) return '🌫️';
  if (normalizedCondition.includes('cloud')) return '⛅';
  if (normalizedCondition.includes('sun') || normalizedCondition.includes('clear')) return '☀️';
  return '🌡️';
};

const DashboardWeather: React.FC<WeatherProps> = ({ lat, lon, variant }) => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      const latitude = Number(lat);
      const longitude = Number(lon);

      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setError('Invalid coordinates provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
        if (!response.ok) {
          throw new Error(`Weather service error (${response.status})`);
        }

        const json = await response.json();
        const period = json.period;

        setData({
          temperature: period.temperature,
          humidity: period.humidity,
          windSpeed: period.windSpeed,
          condition: period.shortForecast,
          periodName: period.name,
          forecastUrl: json.forecastUrl,
          unit: `°${period.temperatureUnit}`,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load weather');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [lat, lon]);

  if (loading) {
    return <Box>Loading weather...</Box>;
  }

  if (error || !data) {
    return <Box>⚠️ {error || 'No weather data available!'}</Box>;
  }

  return (
    <Link
      color="textPrimary"
      href={data.forecastUrl}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'none',
        },
      }}
    >
      {variant === 'standard' ? <DashboardWeatherStandard data={data} /> : <DashboardWeatherCompact data={data} />}
    </Link>
  );
};

function DashboardWeatherStandard({ data }: { data: WeatherData }) {
  const icon = getWeatherIcon(data.condition);
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography component="span" sx={{ fontSize: 28 }}>
        {icon}
      </Typography>
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {data.periodName}
        </Typography>
        <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
          {data.temperature}
          {data.unit}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {data.condition} • Wind: {data.windSpeed} • Humidity: {data.humidity ?? 'Unavailable'}%
        </Typography>
      </Box>
    </Stack>
  );
}

function DashboardWeatherCompact({ data }: { data: WeatherData }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
        {data.temperature}
        {data.unit}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {data.condition} • Wind: {data.windSpeed} • Humidity: {data.humidity ?? 'Unavailable'}%
      </Typography>
    </Stack>
  );
}

export function DashboardWeatherDividedSection({ lat, lon }: WeatherProps) {
  return (
    <DashboardDividedSection title="Weather">
      <DashboardWeather lat={lat} lon={lon} variant="compact" />
    </DashboardDividedSection>
  );
}

export function DashboardWeatherTile({ lat, lon }: WeatherProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
      <DashboardWeather lat={lat} lon={lon} variant="standard" />
    </Paper>
  );
}
