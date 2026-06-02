/**
 * @jest-environment node
 *
 * End-to-end integration proof for the SMR partner API.
 *
 * This test exercises the REAL route handlers (GET list, GET single, POST
 * participant write-back) against a faithful in-memory data layer. Writes are
 * applied through the application's actual activity reducer via immer — exactly
 * as the production StateManager does — so a successful write-back genuinely
 * mutates state and is visible on a subsequent read.
 *
 * It proves, without needing a running MongoDB:
 *   - x-api-key authentication (missing / invalid -> 401)
 *   - org scoping on reads (SMR sees only in-scope activities)
 *   - 404 for out-of-scope / unknown activities
 *   - request validation (400 on bad body)
 *   - SMR write-back succeeds and is reflected on re-read
 *   - SMR guardrail: cannot overwrite a participant coded to another org (403)
 */
import produce from 'immer';
import { NextRequest } from 'next/server';

import { type ActivityAction, BasicActivityReducers } from '@respond/lib/state';
import { Activity, createNewActivity, ParticipantStatus } from '@respond/types/activity';

const SMR_ORG = '3';
const OTHER_ORG = '9';
const API_KEY = 'test-smr-key-abcdef0123456789';

// ---- Faithful in-memory StateManager (mirrors production write pipeline) ----
class FakeStateManager {
  state: { list: Activity[] };
  constructor(seed: Activity[]) {
    this.state = { list: seed };
  }
  async getAllActivities(): Promise<Activity[]> {
    return this.state.list;
  }
  async handleIncomingAction(action: ActivityAction): Promise<void> {
    this.state = produce(this.state, (draft) => {
      const reducer = (BasicActivityReducers as Record<string, (s: typeof draft, a: ActivityAction) => void>)[action.type];
      reducer(draft, action);
    });
  }
}

let stateManager: FakeStateManager;

// Mock the heavy service layer and the mongo-backed scope lookup.
jest.mock('@respond/lib/server/services', () => ({
  getServices: jest.fn(async () => ({ stateManager })),
}));
jest.mock('@respond/lib/server/mongodb', () => ({
  // SMR scope resolves to just its own org for this proof.
  getRelatedOrgIds: jest.fn(async (orgId: string) => [orgId]),
}));

// Route handlers must be required AFTER the mocks are registered.

import { POST as updateParticipant } from './activities/[activityId]/participants/route';
import { GET as getActivity } from './activities/[activityId]/route';
import { GET as listActivities } from './activities/route';

// ---- Lightweight NextRequest stubs (only the bits the handlers use) ----
function makeGet(apiKey: string | null, query = ''): NextRequest {
  return {
    headers: { get: (h: string) => (h.toLowerCase() === 'x-api-key' ? apiKey : null) },
    nextUrl: { searchParams: new URLSearchParams(query) },
  } as unknown as NextRequest;
}
function makePost(apiKey: string | null, body: unknown): NextRequest {
  return {
    headers: { get: (h: string) => (h.toLowerCase() === 'x-api-key' ? apiKey : null) },
    json: async () => body,
  } as unknown as NextRequest;
}

function seed(): Activity[] {
  // In-scope SMR mission, with a participant already coded to ANOTHER org.
  const smrMission = createNewActivity();
  Object.assign(smrMission, {
    id: 'act-smr',
    idNumber: 'SMR-001',
    title: 'Mt. Si missing hiker',
    ownerOrgId: SMR_ORG,
    isMission: true,
    startTime: 1000,
    participants: {
      'p-foreign': {
        id: 'p-foreign',
        firstname: 'Other',
        lastname: 'Responder',
        organizationId: OTHER_ORG,
        miles: undefined,
        eta: undefined,
        timeline: [{ time: 900, status: ParticipantStatus.SignedIn, organizationId: OTHER_ORG }],
      },
    },
  });

  // Out-of-scope activity owned by a different org.
  const otherActivity = createNewActivity();
  Object.assign(otherActivity, {
    id: 'act-other',
    idNumber: 'OTH-001',
    title: 'Other org training',
    ownerOrgId: OTHER_ORG,
    isMission: false,
    startTime: 2000,
  });

  return [smrMission, otherActivity];
}

beforeEach(() => {
  stateManager = new FakeStateManager(seed());
  process.env.PARTNER_API_KEYS = JSON.stringify({ [API_KEY]: SMR_ORG });
});

describe('partner API – authentication', () => {
  it('rejects a request with no api key (401)', async () => {
    const res = await listActivities(makeGet(null));
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid api key (401)', async () => {
    const res = await listActivities(makeGet('wrong-key'));
    expect(res.status).toBe(401);
  });
});

describe('partner API – reads are org-scoped', () => {
  it('returns only in-scope activities for the SMR partner', async () => {
    const res = await listActivities(makeGet(API_KEY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.map((a: Activity) => a.id)).toEqual(['act-smr']);
  });

  it('filters by type (no events in scope)', async () => {
    const res = await listActivities(makeGet(API_KEY, 'type=events'));
    const json = await res.json();
    expect(json.data).toHaveLength(0);
  });

  it('returns a single in-scope activity', async () => {
    const res = await getActivity(makeGet(API_KEY), { params: { activityId: 'act-smr' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe('act-smr');
  });

  it('returns 404 for an out-of-scope activity', async () => {
    const res = await getActivity(makeGet(API_KEY), { params: { activityId: 'act-other' } });
    expect(res.status).toBe(404);
  });
});

describe('partner API – write-back', () => {
  it('writes a new SMR participant and the change is visible on re-read', async () => {
    const res = await updateParticipant(
      makePost(API_KEY, {
        participantId: 'p-smr',
        firstname: 'Dana',
        lastname: 'Member',
        status: ParticipantStatus.SignedIn,
        time: 1500,
      }),
      { params: { activityId: 'act-smr' } },
    );
    expect(res.status).toBe(200);

    // Re-read through the API to confirm the write landed.
    const after = await getActivity(makeGet(API_KEY), { params: { activityId: 'act-smr' } });
    const json = await after.json();
    const p = json.data.participants['p-smr'];
    expect(p).toBeDefined();
    expect(p.organizationId).toBe(SMR_ORG);
    expect(p.timeline[0].status).toBe(ParticipantStatus.SignedIn);
  });

  it('blocks overwriting a participant coded to another org (403)', async () => {
    const res = await updateParticipant(
      makePost(API_KEY, {
        participantId: 'p-foreign',
        status: ParticipantStatus.SignedOut,
        time: 1600,
      }),
      { params: { activityId: 'act-smr' } },
    );
    expect(res.status).toBe(403);
  });

  it('rejects an invalid status value (400)', async () => {
    const res = await updateParticipant(makePost(API_KEY, { participantId: 'p-smr', status: 999 }), { params: { activityId: 'act-smr' } });
    expect(res.status).toBe(400);
  });

  it('rejects a missing participantId (400)', async () => {
    const res = await updateParticipant(makePost(API_KEY, { status: ParticipantStatus.SignedIn }), { params: { activityId: 'act-smr' } });
    expect(res.status).toBe(400);
  });

  it('rejects a write to an out-of-scope activity (404)', async () => {
    const res = await updateParticipant(makePost(API_KEY, { participantId: 'p-smr', status: ParticipantStatus.SignedIn }), { params: { activityId: 'act-other' } });
    expect(res.status).toBe(404);
  });
});
