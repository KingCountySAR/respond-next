import { createTheme, type Theme } from '@mui/material/styles';
import type { SiteConfig } from '@sync/domain';

/** The legacy app's theme: the site's primary colour, grey backgrounds, and a `danger` colour. */
export function buildTheme(theme: SiteConfig['theme'], dark: boolean): Theme {
  return createTheme({
    palette: {
      mode: dark ? 'dark' : 'light',
      background: { default: dark ? '#222' : '#eee' },
      primary: { main: (dark ? theme.primaryDark : theme.primary) ?? theme.primary },
      danger: { main: 'rgb(192,0,0)', contrastText: '#fff' },
    },
  });
}
