import { NextRequest, NextResponse } from 'next/server';

import { authenticatePartner } from '@respond/lib/server/partnerAuth';
import { getPartnerOrgScope, isActivityInScope } from '@respond/lib/server/partnerScope';
import { getServices } from '@respond/lib/server/services';

/**
 * GET /api/partner/v1/activities/[activityId]
 *
 * Returns a single mission/event (with full participant response detail) if it
 * is within the partner org's scope. Returns 404 for both "not found" and
 * "out of scope" so partners cannot probe for activities they can't see.
 *
 * Auth: `x-api-key` header.
 */
export async function GET(request: NextRequest, { params }: { params: { activityId: string } }) {
  const partner = authenticatePartner(request);
  if (!partner) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  const scope = await getPartnerOrgScope(partner);
  const all = await (await getServices()).stateManager.getAllActivities();
  const activity = all.find((a) => a.id === params.activityId);

  if (!activity || !isActivityInScope(activity, scope)) {
    return NextResponse.json({ status: 'not found' }, { status: 404 });
  }

  return NextResponse.json({ status: 'ok', data: activity });
}
