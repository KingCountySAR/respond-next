import { getRelatedOrgIds } from '@respond/lib/server/mongodb';
import { Activity } from '@respond/types/activity';

import { PartnerContext } from './partnerAuth';

/**
 * Resolves the set of organization ids a partner is allowed to see: their own
 * org plus any partner orgs configured on the organization document. Falls back
 * to just the partner's own org id if the org document can't be loaded.
 */
export async function getPartnerOrgScope(partner: PartnerContext): Promise<Set<string>> {
  const related = await getRelatedOrgIds(partner.orgId);
  return new Set(related.length ? related : [partner.orgId]);
}

/** True if the activity is owned by, or includes, any org in the scope set. */
export function isActivityInScope(activity: Activity, scope: Set<string>): boolean {
  if (scope.has(activity.ownerOrgId)) {
    return true;
  }
  return Object.keys(activity.organizations ?? {}).some((orgId) => scope.has(orgId));
}

/** Filters a list of activities down to those visible to the partner scope. */
export function scopeActivities(activities: Activity[], scope: Set<string>): Activity[] {
  return activities.filter((a) => isActivityInScope(a, scope));
}
