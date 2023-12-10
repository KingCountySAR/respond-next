import { NextResponse } from 'next/server';

import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import { getLocations } from '@respond/lib/server/mongodb';

export async function GET() {
  const user = userFromAuth(await getCookieAuth());
  if (user == null) {
    return NextResponse.json({ status: 'not authenticated' }, { status: 401 });
  }
  const list = await getLocations();
  return NextResponse.json({ status: 'ok', data: list });
}
