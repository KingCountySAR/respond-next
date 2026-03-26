import { ClientEnvironment } from '@app/shared';
import { createTheme, Theme } from '@mui/material/styles';
import { action, computed, makeObservable, observable } from 'mobx';

export interface ConfigContext {
  readonly isDarkMode: boolean;
  readonly env: ClientEnvironment;
  readonly theme: Theme;
}

export class ConfigStore {
  @observable accessor isDarkMode: boolean = window.matchMedia('(prefers-color-scheme: dark)').matches;

  readonly env: ClientEnvironment;

  constructor(envData: ClientEnvironment) {
    makeObservable(this);
    this.env = envData;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    // Arrow function so `this` is the store — MobX action so the
    // observable write is tracked and triggers re-renders
    mql.addEventListener('change', action((e: MediaQueryListEvent) => {
      this.isDarkMode = e.matches;
      console.log('updated dark/light', this.isDarkMode);
    }));
  }

  @computed
  get theme(): Theme {
    const mode = this.isDarkMode ? 'dark' : 'light';
    const primary = this.isDarkMode ? (this.env.brand.primaryDark ?? this.env.brand.primary) : this.env.brand.primary;
    const base = createTheme({ palette: { mode } });

    return createTheme({
      palette: {
        mode,
        primary: base.palette.augmentColor({
          color: { main: primary },
          name: 'primary',
        }),
      },
    });
  }
}
