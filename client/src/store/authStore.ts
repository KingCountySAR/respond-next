import { action, computed, makeObservable, observable, runInAction } from 'mobx'

export interface LoginUser {
  email: string
  name: string
  picture?: string
}

export class AuthStore {
  @observable accessor working: boolean = false
  @observable accessor inited: boolean = false

  @observable accessor error: string = ''

  @observable accessor user: LoginUser|undefined = undefined

  @observable private accessor clientId: string = ''

  private initPromise: Promise<void>|undefined = undefined
  private gsiPromise: Promise<void> | undefined = undefined

  constructor() {
    makeObservable(this)
  }

  @computed
  get loggedIn() {
    return this.user != null
  }

  async init() {
    if (!this.initPromise) {
      this.initPromise = new Promise(this.initBody)
    }
    return this.initPromise
  }

  @action.bound
  private async initBody(resolve: () => void) {
    this.working = true
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' })
      if (response.ok) {
        const json = await response.json()
        runInAction(() => {
          if (json.clientId) {
            this.clientId = json.clientId
          } else {
            this.user = json.login
          }
          this.inited = true
        })
      } else {
        console.log('cant get auth info', await response.text())
      }
    } catch (e) {
      runInAction(() => {
        this.user = undefined
        this.error = e + ''
      })
    } finally {
      runInAction(() => {
        this.working = false
      })
    }
    resolve()
  }

  /**
   * Configures a DIV element to be a Google GSI login button. Loads the GSI script if it hasn't been loaded
   * @param button The button
   */
  async setupButton(button: HTMLDivElement) {
    await this.init()
    await this.loadGsiScript()

    await this.gsiPromise
    if (button.isConnected && window.google) {
      window.google.accounts.id.renderButton(button, {
        theme: 'outline',
        size: 'large',
        text: 'sign_in_with',
      })
    }
  }

  private loadGsiScript(): Promise<void>   {
    if (!this.gsiPromise) {
      if (!this.clientId) {
        throw new Error('dont have auth config')
      }

      this.gsiPromise = new Promise(resolve => {
        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.onload = () => {
          if (!window.google) {
            return
          }

          window.google.accounts.id.initialize({
            client_id: this.clientId,
            callback: async ({ credential }: { credential: string }) => {
              await this.processCredential(credential)
            },
          })

          resolve()
        }
        document.body.appendChild(script)
      })
    }
    return this.gsiPromise
  }

  @action.bound
  private async processCredential(credential: string) {
    this.working = true
    this.error = ''

    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    if (response.ok) {
      const json = await response.json()
      runInAction(() => this.user = json.login)
    }
    runInAction(() => {
      this.working = false
    })
    return Promise.resolve()
  }

  @action.bound
  async logout() {
    this.working = true
    this.error = ''

    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    if (response.ok) {
      runInAction(() => {
        this.user = undefined;
      })
    }
    runInAction(() => {
      this.working = false
    })
  }
}