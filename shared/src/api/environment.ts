import { ApiResult } from './common.js';

import { ClientLogin } from './index.js';

export interface ClientEnvironment {
  readonly title: string;
  readonly shortTitle?: string;
  readonly brand: {
    readonly primary: string;
    readonly primaryDark?: string;
  }
}

export interface BootData {
  googleClientId: string;
  environment: ClientEnvironment;
  login?: ClientLogin;
}

export type BootDataResult = ApiResult<BootData>;
