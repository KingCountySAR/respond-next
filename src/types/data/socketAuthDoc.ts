import UserAuth from '../userAuth';

export interface SocketAuthDoc {
  user: UserAuth;
  created: Date;
}