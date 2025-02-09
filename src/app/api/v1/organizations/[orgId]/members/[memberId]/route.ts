import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@respond/auth';
import * as Mongo from '@respond/lib/server/mongodb';
import { getServices } from '@respond/lib/server/services';

export async function GET(_request: NextRequest, { params }: { params: { orgId: string; memberId: string } }) {
  const session = await auth();
  if (!session?.user) {
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

  const memberInfo = await memberProvider.getParticipantInfo(params.memberId);

  if (!memberInfo) {
    return NextResponse.json({ status: 'not found' }, { status: 404 });
  }

  return NextResponse.json({ data: memberInfo, status: 200 });
}
