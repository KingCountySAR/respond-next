import { NextRequest, NextResponse } from 'next/server';

import { authenticatePartner } from '@respond/lib/server/partnerAuth';
import { getPartnerOrgScope, scopeActivities } from '@respond/lib/server/partnerScope';
import { getServices } from '@respond/lib/server/services';

/**
 * GET /api/partner/v1/activities
 *
 * Returns the missions/events visible to the authenticated partner org,
 * including full participant response timelines. Read-only.
 *
 * Auth: `x-api-key` header.
 * Optional query param `type` = "missions" | "events" to filter.
 */
export async function GET(request: NextRequest) {
  const partner = authenticatePartner(request);
  if (!partner) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  const scope = await getPartnerOrgScope(partner);
  const all = await (await getServices()).stateManager.getAllActivities();

  const scoped = scopeActivities(all, scope).sort((a, b) => a.startTime - b.startTime);

  const type = request.nextUrl.searchParams.get('type');
  const data = type === 'missions' ? scoped.filter((a) => a.isMission) : type === 'events' ? scoped.filter((a) => !a.isMission) : scoped;

  return NextResponse.json({ status: 'ok', data });
}
