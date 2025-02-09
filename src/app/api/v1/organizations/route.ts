import { NextRequest, NextResponse } from 'next/server';

import * as Mongo from '@respond/lib/server/mongodb';

export async function GET(_request: NextRequest) {
  const organizations = await Mongo.getOrganizations();
  if (!organizations) {
    return NextResponse.json({ status: 'get organizations failed' }, { status: 500 });
  }
  console.log(organizations);
  return NextResponse.json({
    status: 'ok',
    data: organizations,
  });
}
