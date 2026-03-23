import { ApiResult } from './common.js';

import { ClientLogin } from './index.js';

export interface ClientEnvironment {
  readonly shortTitle: string;
  readonly primaryColor: string;
}

export interface BootData {
  googleClientId: string;
  environment: ClientEnvironment;
  login?: ClientLogin;
}

export type BootDataResult = ApiResult<BootData>;
