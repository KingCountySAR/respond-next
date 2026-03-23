import { ClientLogin } from '@app/shared';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';

export class AuthStore {
  @observable accessor working: boolean = false;
  @observable accessor inited: boolean = false;

  @observable accessor error: string = '';

  @observable accessor user: ClientLogin|undefined = undefined;

  private gsiPromise: Promise<void> | undefined = undefined;

  constructor(private readonly googleClientId: string, initialLogin: ClientLogin|undefined) {
    makeObservable(this);
    this.googleClientId = googleClientId;
    runInAction(() => this.user = initialLogin);
  }

  @computed
  get loggedIn() {
    return this.user != null;
  }

  /**
   * Configures a DIV element to be a Google GSI login button. Loads the GSI script if it hasn't been loaded
   * @param button The button
   */
  async setupButton(button: HTMLDivElement) {
    await this.loadGsiScript();

    await this.gsiPromise;
    if (button.isConnected && window.google) {
      window.google.accounts.id.renderButton(button, {
        theme: 'outline',
        size: 'large',
        text: 'sign_in_with',
      });
    }
  }

  /**
   * Load the script for Google client-side login button
   * @returns
   */
  private loadGsiScript(): Promise<void>   {
    if (!this.gsiPromise) {
      if (!this.googleClientId) {
        throw new Error('dont have auth config');
      }

      this.gsiPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => {
          if (!window.google) {
            return;
          }

          window.google.accounts.id.initialize({
            client_id: this.googleClientId,
            callback: async ({ credential }: { credential: string }) => {
              await this.processCredential(credential);
            },
          });

          resolve();
        };
        document.body.appendChild(script);
      });
    }
    return this.gsiPromise;
  }

  /**
   * Convert Google GSI token into a login session
   * @param credential credential from Google GSI button
   * @returns
   */
  @action.bound
  private async processCredential(credential: string) {
    this.working = true;
    this.error = '';

    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (response.ok) {
      const json = await response.json();
      runInAction(() => this.user = json.login);
    }
    runInAction(() => {
      this.working = false;
    });
    return Promise.resolve();
  }

  /**
   * Logout of the app and destroy the server session
   */
  @action.bound
  async logout() {
    this.working = true;
    this.error = '';

    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (response.ok) {
      runInAction(() => {
        this.user = undefined;
      });
    }
    runInAction(() => {
      this.working = false;
    });
  }
}
