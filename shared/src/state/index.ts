import { Activity } from '../types/activity';
import { Location } from '../types/location';
import { Organization } from '../types/organization';

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
export { BasicEventReducers } from './eventReducers';
export { filterInitialActivities } from './activityVisibility';
export { BasicReducers as BasicLocationReducers } from './locationReducers';
export { BasicLocationEventReducers } from './locationEventReducers';
