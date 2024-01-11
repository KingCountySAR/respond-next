import { Activity } from '@respond/types/activity';
import { Location } from '@respond/types/location';

export interface ActivityState {
  list: Activity[];
}

export interface LocationState {
  list: Location[];
}

export type { ActivityAction } from './activityActions';
export { ActivityActions } from './activityActions';

export type { LocationAction } from './locationActions';
export { LocationActions } from './locationActions';

export { BasicReducers as BasicActivityReducers } from './activityReducers';
export { BasicReducers as BasicLocationReducers } from './locationReducers';
