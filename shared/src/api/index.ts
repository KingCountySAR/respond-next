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
