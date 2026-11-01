// MUI theme augmentation for the custom "danger" palette color (used by
// ClientProviders' theme and by <Button color="danger"> / <IconButton color="danger">).
import type { PaletteColor, PaletteColorOptions } from '@mui/material/styles';

/** The dashboard's card colors (shell/theme.ts). */
interface CardPalette {
  normal: string;
  faded: string;
  attention: string;
  hover: string;
  shadow: string;
  raisedShadow: string;
}

declare module '@mui/material/styles' {
  interface Palette {
    danger: PaletteColor;
    card: CardPalette;
  }
  interface PaletteOptions {
    danger?: PaletteColorOptions;
    card?: CardPalette;
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
