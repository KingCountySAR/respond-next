// MUI theme augmentation for the custom "danger" palette color (used by
// ClientProviders' theme and by <Button color="danger"> / <IconButton color="danger">).
import type { PaletteColor, PaletteColorOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    danger: PaletteColor;
  }
  interface PaletteOptions {
    danger?: PaletteColorOptions;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    danger: true;
  }
}

declare module '@mui/material/IconButton' {
  interface IconButtonPropsColorOverrides {
    danger: true;
  }
}
