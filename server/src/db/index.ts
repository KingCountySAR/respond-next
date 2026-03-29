import { Activity } from '@app/shared/api';
import { Session } from '@server/lib/session.js';

export { getDb } from './mongo.js';

export interface SessionDoc {
  sessionId: string;
  version: number;
  content: Omit<Session, 'id'|'expiresAt'>;
  expires: string;
}

export const SESSIONS_COLLECTION = 'user-sessions';

export type ActivityDoc = Activity & { removeTime?: number };
export const ACTIVITIES_COLLECTION = 'activities';
