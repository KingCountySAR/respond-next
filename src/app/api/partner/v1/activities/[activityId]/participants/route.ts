import { NextRequest, NextResponse } from 'next/server';

import { authenticatePartner } from '@respond/lib/server/partnerAuth';
import { getPartnerOrgScope, isActivityInScope } from '@respond/lib/server/partnerScope';
import { getServices } from '@respond/lib/server/services';
import { ActivityActions } from '@respond/lib/state/activityActions';
import { ParticipantStatus } from '@respond/types/activity';

interface ParticipantUpdateBody {
  participantId?: string;
  firstname?: string;
  lastname?: string;
  status?: number;
  time?: number;
  miles?: number;
  eta?: number;
}

const VALID_STATUSES = new Set<number>(Object.values(ParticipantStatus).filter((v): v is number => typeof v === 'number'));

/**
 * POST /api/partner/v1/activities/[activityId]/participants
 *
 * Pushes a participant status update back into Respond on behalf of the partner
 * organization. The update is dispatched through the normal action pipeline
 * (handleIncomingAction) so in-memory state, MongoDB, and all connected
 * websocket clients stay in sync — it does NOT write to MongoDB directly.
 *
 * SCOPE GUARANTEE: a partner may only write participant records coded to its
 * own organization. The participant's organizationId is forced to the partner's
 * org id, and any attempt to modify a participant already coded to a different
 * org is rejected with 403.
 *
 * Auth: `x-api-key` header.
 *
 * Body:
 *   { participantId, firstname?, lastname?, status, time?, miles?, eta? }
 */
export async function POST(request: NextRequest, { params }: { params: { activityId: string } }) {
  const partner = authenticatePartner(request);
  if (!partner) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  let body: ParticipantUpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'bad request', message: 'Invalid JSON body' }, { status: 400 });
  }

  const { participantId, firstname, lastname, status, time, miles, eta } = body;

  if (!participantId || typeof participantId !== 'string') {
    return NextResponse.json({ status: 'bad request', message: 'participantId is required' }, { status: 400 });
  }
  if (typeof status !== 'number' || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ status: 'bad request', message: 'status must be a valid ParticipantStatus value' }, { status: 400 });
  }

  const services = await getServices();
  const all = await services.stateManager.getAllActivities();
  const activity = all.find((a) => a.id === params.activityId);

  const scope = await getPartnerOrgScope(partner);
  if (!activity || !isActivityInScope(activity, scope)) {
    return NextResponse.json({ status: 'not found' }, { status: 404 });
  }

  // SMR scope enforcement: never allow writing over a participant that belongs
  // to another organization.
  const existing = activity.participants?.[participantId];
  if (existing && existing.organizationId !== partner.orgId) {
    return NextResponse.json({ status: 'forbidden', message: 'Participant is coded to a different organization' }, { status: 403 });
  }

  const action = ActivityActions.participantUpdate(
    params.activityId,
    participantId,
    firstname ?? existing?.firstname ?? '',
    lastname ?? existing?.lastname ?? '',
    partner.orgId, // forced to the partner's org — cannot write for other orgs
    typeof time === 'number' ? time : Date.now(),
    status,
    typeof miles === 'number' ? miles : undefined,
    typeof eta === 'number' ? eta : undefined,
  );

  await services.stateManager.handleIncomingAction(action, 'PARTNER_API', {
    userId: `partner:${partner.orgId}`,
    email: `partner-api:${partner.keyId}`,
  });

  return NextResponse.json({ status: 'ok' });
}
