import { NextRequest, NextResponse } from 'next/server';

import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import { getServices } from '@respond/lib/server/services';

export async function GET(_request: NextRequest, { params }: { params: { activityId: string } }) {
  const user = userFromAuth(await getCookieAuth());
  if (user == null) {
    return NextResponse.json({ status: 'not authenticated' }, { status: 401 });
  }

  const activity = (await (await getServices()).stateManager.getAllActivities()).find((a) => a.id === params.activityId);
  if (!activity) {
    return NextResponse.json({ status: 'not found' }, { status: 404 });
  }

  return NextResponse.json({ status: 'ok', data: activity });
}
