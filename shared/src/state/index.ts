import { Activity } from '../types/activity';
import { Organization } from '../types/organization';

export interface ActivityState {
  list: Activity[];
}

export interface OrganizationState {
  list: Organization[];
}

export { BasicEventReducers } from './eventReducers';
export { filterInitialActivities } from './activityVisibility';
