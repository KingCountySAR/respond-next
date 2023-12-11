import { NextRequest, NextResponse } from 'next/server';

import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import { createLocation } from '@respond/lib/server/mongodb';

export async function POST(req: NextRequest) {
  const user = userFromAuth(await getCookieAuth());
  if (user == null) {
    return NextResponse.json({ status: 'not authenticated' }, { status: 401 });
  }
  const data = await req.json();
  const result = await createLocation(data);
  return NextResponse.json(result);
}
