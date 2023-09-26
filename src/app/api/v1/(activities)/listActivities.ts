import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import { NextResponse } from 'next/server';

import mongoPromise from '@respond/lib/server/mongodb';
import { getServices } from '@respond/lib/server/services';
import { ActivityType } from '@respond/types/activity';

export async function getActivitiesList(activityType: ActivityType, request: Request) {
  const user = userFromAuth(await getCookieAuth());
  if (user == null) {
    return NextResponse.json({ status: 'not authenticated' }, { status: 401 });
  }

  const mongo = await mongoPromise;

  const list = (await (await getServices()).stateManager.getAllActivities())
  .filter(a => a.isMission === (activityType === 'missions'))
  .sort((a,b) => (a.startTime > b.startTime) ? 1 : (a.startTime < b.startTime) ? -1 : 0);

  return NextResponse.json({ status: 'ok', data: list });
}