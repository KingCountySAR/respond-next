import { NextRequest, NextResponse } from 'next/server';

import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import * as Mongo from '@respond/lib/server/mongodb';
import { getServices } from '@respond/lib/server/services';

export async function GET(_request: NextRequest, { params }: { params: { orgId: string; memberId: string } }) {
  const user = userFromAuth(await getCookieAuth());
  if (user == null) {
    return NextResponse.json({ status: 'not authenticated' }, { status: 401 });
  }

  const organizationDoc = await Mongo.getOrganizationById(params.orgId);
  if (!organizationDoc) {
    return NextResponse.json({ status: 'unknown organization' }, { status: 500 });
  }

  const memberProvider = (await getServices()).memberProviders.get(organizationDoc.memberProvider.provider);
  if (!memberProvider) {
    console.log(`Can't find memberProvider for org ${organizationDoc.id}: ${organizationDoc.memberProvider?.provider}`);
    return NextResponse.json({ status: 'unknown member provider' }, { status: 500 });
  }

  const photo = await memberProvider.getMemberPhoto(params.memberId);

  if (!photo) {
    return NextResponse.json({ status: 'not found' }, { status: 404 });
  }
  return new NextResponse(photo, { status: 200 });
}
