import { NextRequest, NextResponse } from 'next/server';

import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import * as Mongo from '@respond/lib/server/mongodb';

export async function GET(_request: NextRequest) {
  const user = userFromAuth(await getCookieAuth());
  if (user == null) {
    return NextResponse.json({ status: 'not authenticated' }, { status: 401 });
  }

  const organizations = await Mongo.getOrganizations();
  if (!organizations) {
    return NextResponse.json({ status: 'get organizations failed' }, { status: 500 });
  }

  return NextResponse.json({
    status: 'ok',
    data: organizations,
  });
}
