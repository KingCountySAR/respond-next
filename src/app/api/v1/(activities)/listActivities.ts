import { NextResponse } from 'next/server';

import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import { getServices } from '@respond/lib/server/services';
import { ActivityType } from '@respond/types/activity';

export async function getActivitiesList(activityType: ActivityType) {
  const user = userFromAuth(await getCookieAuth());
  if (user == null) {
    return NextResponse.json({ status: 'not authenticated' }, { status: 401 });
  }

  const list = (await (await getServices()).stateManager.getAllActivities()) //
    .filter((a) => a.isMission === (activityType === 'missions'))
    .sort((a, b) => (a.startTime > b.startTime ? 1 : a.startTime < b.startTime ? -1 : 0));

  return NextResponse.json({ status: 'ok', data: list });
}
