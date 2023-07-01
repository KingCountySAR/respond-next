import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { RelativeTimeText } from './RelativeTimeText';

export const OutputTime = ({ label, time, relative }: { label: string, time?: number, relative?: boolean }) => {

  const [ nowTime, setNowTime ] = useState<number>(new Date().getTime());

  useEffect(() => {
    const interval = setInterval(() => setNowTime(new Date().getTime()), 5000);
    return () => {
      clearInterval(interval);
    }
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: 'grey.200' }} borderBottom={1} >
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: "2em" }}>{label}:</Typography>
      {time && <RelativeTimeText time={time ?? 0} baseTime={nowTime} defaultToTime={!relative} />}
    </Box>
  );

}