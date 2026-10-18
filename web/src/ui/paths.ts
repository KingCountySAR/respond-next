import type { FieldActivity } from '@sync/model';

/** The legacy URL: missions under /mission, everything else under /event. */
export const activityPath = (activity: FieldActivity): string => `/${activity.record?.kind === 'mission' ? 'mission' : 'event'}/${activity.activityId}`;
