import { Grid } from '@mui/material';
import React, { ReactNode } from 'react';

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
