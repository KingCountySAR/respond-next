import { NextResponse } from 'next/server';

import { auth } from '@respond/auth';
import { getServices } from '@respond/lib/server/services';
import { ActivityType } from '@respond/types/activity';

export async function getActivitiesList(activityType: ActivityType) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ status: 'not authenticated' }, { status: 401 });
  }

  const list = (await (await getServices()).stateManager.getAllActivities()) //
    .filter((a) => a.isMission === (activityType === 'missions'))
    .sort((a, b) => (a.startTime > b.startTime ? 1 : a.startTime < b.startTime ? -1 : 0));

  return NextResponse.json({ status: 'ok', data: list });
}
