import type { MongoClient } from 'mongodb';

declare global {
  var _mongoClientPromise: Promise<MongoClient>;
}

declare module '@mui/material/styles' {
  interface palette {
    danger: Palette['primary'];
  }

  interface PaletteOptions {
    danger: Palette['primary'];
  }
}
declare module '@mui/material/Button' { interface ButtonPropsColorOverrides { danger: true; } }
declare module '@mui/material/IconButton' { interface IconButtonPropsColorOverrides { danger: true; } }