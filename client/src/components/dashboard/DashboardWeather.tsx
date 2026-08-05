import React, { useEffect, useState } from 'react';

interface WeatherProps {
  lat: string | number;
  lon: string | number;
  className?: string;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  unit: string;
}

// Maps Open-Meteo WMO Weather Interpretation Codes to human-readable labels & emoji
const getWeatherCondition = (code: number): { label: string; icon: string } => {
  if (code === 0) return { label: 'Clear Sky', icon: '☀️' };
  if (code >= 1 && code <= 3) return { label: 'Partly Cloudy', icon: '⛅' };
  if (code >= 45 && code <= 48) return { label: 'Foggy', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: '🌧️' };
  if (code >= 61 && code <= 65) return { label: 'Rain', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: '❄️' };
  if (code >= 80 && code <= 82) return { label: 'Rain Showers', icon: '🌦️' };
  if (code >= 95) return { label: 'Thunderstorm', icon: '⛈️' };
  return { label: 'Unknown', icon: '🌡️' };
};

export const DashboardWeather: React.FC<WeatherProps> = ({ lat, lon, className = '' }) => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      // Validate decimal coordinates
      const latitude = parseFloat(String(lat));
      const longitude = parseFloat(String(lon));

      if (isNaN(latitude) || isNaN(longitude)) {
        setError('Invalid coordinates provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Weather service error (${response.status})`);
        }

        const json = await response.json();
        const current = json.current;

        setData({
          temperature: Math.round(current.temperature_2m),
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          weatherCode: current.weather_code,
          unit: json.current_units?.temperature_2m || '°F',
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
    return (
      <div className={`weather-card loading ${className}`}>
        <span>Loading weather...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`weather-card error ${className}`}>
        <span>⚠️ {error || 'No weather data available'}</span>
      </div>
    );
  }

  const { label, icon } = getWeatherCondition(data.weatherCode);

  return (
    <div
      className={`weather-card ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <span style={{ fontSize: '28px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {data.temperature}
          {data.unit}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          {label} • Wind: {data.windSpeed} mph • Humidity: {data.humidity}%
        </div>
      </div>
    </div>
  );
};
