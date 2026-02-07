import { Activity } from '@respond/types/activity';
import { Location } from '@respond/types/location';
import { Organization } from '@respond/types/organization';

export interface ActivityState {
  list: Activity[];
}

export interface OrganizationState {
  list: Organization[];
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
