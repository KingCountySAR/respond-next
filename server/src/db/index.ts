import { Session } from '@server/lib/session';

export { getDb } from './mongo';

export interface SessionDoc {
  sessionId: string;
  version: number;
  content: Omit<Session, 'id'|'expiresAt'>;
  expires: string;
}

export const SESSIONS_COLLECTION = 'user-sessions';
