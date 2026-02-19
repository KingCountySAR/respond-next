import { NextRequest, NextResponse } from 'next/server';

import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import * as Mongo from '@respond/lib/server/mongodb';
import { getServices } from '@respond/lib/server/services';

export async function GET(_request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const user = userFromAuth(await getCookieAuth());
    if (user == null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationDoc = await Mongo.getOrganizationById(params.orgId);
    if (!organizationDoc) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const memberProvider = (await getServices()).memberProviders.get(organizationDoc.memberProvider.provider);
    if (!memberProvider) {
      console.error(`Member provider not found for org ${organizationDoc.id}: ${organizationDoc.memberProvider?.provider}`);
      return NextResponse.json({ error: 'Member provider not configured' }, { status: 500 });
    }

    const searchParams = _request.nextUrl.searchParams;
    const query = searchParams.get('query')?.trim() ?? '';

    if (query.length < 3 || query.length > 100) {
      return NextResponse.json({ error: 'Query must be between 3 and 100 characters' }, { status: 400 });
    }

    const list = await memberProvider.searchMembers(organizationDoc.id, query);

    if (!list) {
      return NextResponse.json({ error: 'No results found' }, { status: 404 });
    }

    return NextResponse.json({ data: list });
  } catch (error) {
    console.error('Error searching members:', error);
    return NextResponse.json({ error: 'Failed to search members' }, { status: 500 });
  }
}
