import { Grid } from '@mui/material';
import React, { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RelativeTimeText } from './RelativeTimeText';

export const OutputForm = ({ children }: { children: ReactNode }) => {

  const childrenArray = React.Children.toArray(children);

  const outputFields = childrenArray.map((child, index) => {
    return (
      <Grid key={index} item xs={12} sm={6}>
        {child}
      </Grid>
    )
  });

  return (
    <Grid container columnSpacing={{ xs: 0, sm: 2 }}>
      {outputFields.length && outputFields}
    </Grid>
  );

}

const OutputField = ({ label, multiline, children, }: { label: string, multiline?: boolean, children: React.ReactNode }) => {

  const flexDirection = multiline ? 'column' : 'Row';
  const alignItems = multiline ? 'start' : 'center';

  return (
    <Box sx={{ display: "flex", flexDirection: {flexDirection}, alignItems: {alignItems}, justifyContent: "space-between", borderColor: 'grey.200' }} borderBottom={1} >
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: "2em" }}>{label}</Typography>
      {children}
    </Box>
  );

}

export const OutputText = ({ label, value }: { label: string, value?: string }) => {
  return (
    <OutputField label={label}>
      {(value !== undefined) && <Typography variant="body1">{value}</Typography>}
    </OutputField>
  );
}

export const OutputTextArea = ({ label, value }: { label: string, value?: string }) => {
  return (
    <OutputField label={label} multiline>
      {(value !== undefined) &&  (value.split('\n').map((v,i) => {
        if (v === '') {
          return <br key={i} />
        }
        return <Typography key={i} variant="body1">{v}</Typography>
      }))}
    </OutputField>
  );
}

export const OutputLink = ({ label, value, href, target }: { label: string, value?: string, href?: string, target?: '_blank' | '_parent' | '_self' | '_top' }) => {
  return (
    <OutputField label={label}>
      {(value !== undefined) && <Link href={href ?? '#'} target={target ?? '_blank'}>{value}</Link>}
    </OutputField>
  );
}

export const OutputTime = ({ label, time, relative }: { label: string, time?: number, relative?: boolean }) => {

  const [ nowTime, setNowTime ] = useState<number>(new Date().getTime());

  useEffect(() => {
    const interval = setInterval(() => setNowTime(new Date().getTime()), 5000);
    return () => {
      clearInterval(interval);
    }
  });

  return (
    <OutputField label={label}>
      {time && <RelativeTimeText time={time} baseTime={nowTime} defaultToTime={!relative} />}
    </OutputField>
  );
}