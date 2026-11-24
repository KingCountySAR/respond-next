import { createTheme, type Theme } from '@mui/material/styles';
import type { SiteConfig } from '@sync/domain';

/**
 * The dashboard's cards, by mode: `normal`; `faded`, for those not available; `attention`, for
 * someone on a team who isn't assigned yet; `hover`, a tint laid over any of them; and the shadows.
 */
const CARD = {
  light: { normal: '#fff', faded: '#e0e0e0', attention: '#f0bcbc', hover: 'rgba(0,0,0,0.04)', shadow: '0 1px 2px rgba(16,24,40,0.06)', raisedShadow: '0 6px 14px rgba(16,24,40,0.12)' },
  // faded is halfway between the paper (#121212) and grey[700] (#616161).
  dark: { normal: '#121212', faded: '#3a3a3a', attention: '#5c2b2b', hover: 'rgba(255,255,255,0.06)', shadow: '0 1px 2px rgba(0,0,0,0.4)', raisedShadow: '0 6px 14px rgba(0,0,0,0.5)' },
};

/** The legacy app's theme: the site's primary color, grey backgrounds, and a `danger` color. */
export function buildTheme(theme: SiteConfig['theme'], dark: boolean): Theme {
  return createTheme({
    palette: {
      mode: dark ? 'dark' : 'light',
      background: { default: dark ? '#222' : '#eee' },
      primary: { main: (dark ? theme.primaryDark : theme.primary) ?? theme.primary },
      danger: { main: 'rgb(192,0,0)', contrastText: '#fff' },
      card: CARD[dark ? 'dark' : 'light'],
    },
    components: {
      // On a narrow screen a dialog's buttons wrap to another row, rather than wrapping their labels.
      MuiDialogActions: {
        defaultProps: { disableSpacing: true },
        styleOverrides: { root: { flexWrap: 'wrap', gap: 8, '& .MuiButton-root': { whiteSpace: 'nowrap' } } },
      },
    },
  });
}
