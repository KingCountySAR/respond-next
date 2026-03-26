import { ApiResult } from './common.js';

export * from './activity.js';
export * from './environment.js';
export * from './location.js';
export * from './participant.js';

export interface ClientLogin {
  email: string
  name: string
  picture?: string
  memberId?: string
}

export interface MemberInfo {
  id: string;
  firstname: string;
  lastname: string;
  groups: string[];
  email?: string;
  mobilephone?: string;
}

export type MemberListResult = ApiResult<MemberInfo[]>;
