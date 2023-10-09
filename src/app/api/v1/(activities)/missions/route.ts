import { getActivitiesList } from '../listActivities';

export function GET() {
  return getActivitiesList('missions');
}
