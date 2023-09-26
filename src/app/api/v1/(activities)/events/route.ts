import { getActivitiesList } from '../listActivities';

export function GET(request: Request) {
  return getActivitiesList('events', request);
}