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

export { BasicEventReducers } from './eventReducers';
export { filterInitialActivities } from './activityVisibility';
export { BasicLocationReducers } from './locationReducers';
