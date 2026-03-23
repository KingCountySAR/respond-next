import { ClientEnvironment } from "@app/shared";
import { action, makeObservable, observable } from "mobx";

export class EnvironmentStore {
  constructor(readonly data: ClientEnvironment) {}
}

export interface ConfigContext {
  readonly isDarkMode: boolean;
  readonly env: EnvironmentStore;
}

export class ConfigStore {
  @observable accessor isDarkMode: boolean = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  readonly env: EnvironmentStore;

  constructor(envData: ClientEnvironment) {
    makeObservable(this);
    this.env = new EnvironmentStore(envData);

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    // Arrow function so `this` is the store — MobX action so the
    // observable write is tracked and triggers re-renders
    mql.addEventListener('change', action((e: MediaQueryListEvent) => {
      this.isDarkMode = e.matches;
      console.log('updated dark/light', this.isDarkMode);
    }));
  }
}