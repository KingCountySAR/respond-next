import { Activity } from '@respond/types/activity';

export interface ActivityState {
  list: Activity[];
}

export type { ActivityAction } from './activityActions';
export { ActivityActions } from './activityActions';

export { BasicReducers } from './activityReducers';
