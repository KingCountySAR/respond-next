import { Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';

import { DashboardMetricTile } from './DashboardMetricTile';

export interface Timer {
  id: string; // Unique identifier for the timer
  label: string; // User-defined label (e.g., "Secondary Search Team 2")
  startTime: string; // ISO 8601 timestamp (editable, defaults to creation time)
}

export function createTimer(label: string, startTime = new Date().toISOString()): Timer {
  return {
    id: uuid(),
    label,
    startTime,
  };
}

function formatElapsed(startTimeIso: string): string {
  const start = new Date(startTimeIso).getTime();
  const now = Date.now();
  const diffInSeconds = Math.max(0, Math.floor((now - start) / 1000));

  const hours = Math.floor(diffInSeconds / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);
  const seconds = diffInSeconds % 60;

  const pad = (num: number) => String(num).padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function DashboardTimer({ timer, variant = 'tile' }: { timer: Timer; variant?: 'tile' | 'inline' }) {
  const [elapsed, setElapsed] = useState<string>(() => formatElapsed(timer.startTime));

  useEffect(() => {
    setElapsed(formatElapsed(timer.startTime));

    const intervalId = setInterval(() => {
      setElapsed(formatElapsed(timer.startTime));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timer.startTime]);

  if (variant === 'inline') {
    return (
      <Typography variant="body2" component="span">
        {timer.label}: {elapsed}
      </Typography>
    );
  }

  return <DashboardMetricTile label={timer.label} value={elapsed} />;
}
