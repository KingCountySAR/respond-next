import { EventMeta } from '@shared/events';

export interface EventDoc {
  id: string;
  type: string;
  activityId?: string;
  payload: unknown;
  meta: EventMeta;
}
