import { Box, Typography } from '@mui/material';
import Link from 'next/link';

export const OutputField = ({ label, value, href, target }: { label: string, value: string, href?: string, target?: string }) => {

  return (
    <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: 'grey.200' }} borderBottom={1} >
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: "2em" }}>{label}:</Typography>
      {!href && <Typography variant="body1">{value}</Typography>}
      {href && <Link href={href} target={target ?? '_blank'}>{value}</Link>}
    </Box>
  );

}