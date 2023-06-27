import { Box, Typography } from '@mui/material';

export const OutputField = ({ label, value }: { label: string, value: string }) => {

  return (
    <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: 'grey.200' }} borderBottom={1} >
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: "2em" }}>{label}:</Typography>
      <Typography variant="body1">{value}</Typography>
    </Box>
  );

}