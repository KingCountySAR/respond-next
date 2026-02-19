import { NextResponse } from 'next/server';

import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import { getServices } from '@respond/lib/server/services';

export async function GET() {
  try {
    const user = userFromAuth(await getCookieAuth());
    if (user == null) {
      return NextResponse.json({ status: 'not authenticated' }, { status: 401 });
    }

    const list = await (await getServices()).stateManager.getAllOrganizations();

    return NextResponse.json({ status: 'ok', data: list });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}
