import { ClientLogin } from '@app/shared';

export interface SessionLogin extends ClientLogin {
  id: string
}
