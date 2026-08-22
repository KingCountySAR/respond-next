import { getRelatedOrgIds } from '@respond/lib/server/mongodb';
import { Activity } from '@respond/types/activity';

import { getPartnerOrgScope, isActivityInScope, scopeActivities } from './partnerScope';

// mongodb.ts throws at import time if MONGODB_URI is unset and connects to a
// real server, so we mock it. getRelatedOrgIds is the only export we use here.
jest.mock('@respond/lib/server/mongodb', () => ({
  __esModule: true,
  default: Promise.resolve({}),
  getRelatedOrgIds: jest.fn(),
}));

const mockedGetRelatedOrgIds = getRelatedOrgIds as jest.MockedFunction<typeof getRelatedOrgIds>;

function activity(partial: Partial<Activity>): Activity {
  return {
    id: 'a1',
    idNumber: '',
    title: '',
    description: '',
    location: {} as Activity['location'],
    mapId: '',
    ownerOrgId: '1',
    isMission: true,
    asMission: false,
    forceStandbyOnly: false,
    startTime: 0,
    participants: {},
    organizations: {},
    ...partial,
  };
}

describe('isActivityInScope', () => {
  it('matches when the activity is owned by an in-scope org', () => {
    expect(isActivityInScope(activity({ ownerOrgId: '3' }), new Set(['3']))).toBe(true);
  });

  it('matches when an in-scope org participates in the activity', () => {
    const a = activity({ ownerOrgId: '1', organizations: { '3': { id: '3', title: 'SMR', timeline: [] } } });
    expect(isActivityInScope(a, new Set(['3']))).toBe(true);
  });

  it('does not match an unrelated activity', () => {
    const a = activity({ ownerOrgId: '1', organizations: { '2': { id: '2', title: 'Other', timeline: [] } } });
    expect(isActivityInScope(a, new Set(['3']))).toBe(false);
  });
});

describe('scopeActivities', () => {
  it('filters to only in-scope activities', () => {
    const list = [activity({ id: 'mine', ownerOrgId: '3' }), activity({ id: 'theirs', ownerOrgId: '9' })];
    const result = scopeActivities(list, new Set(['3']));
    expect(result.map((a) => a.id)).toEqual(['mine']);
  });
});

describe('getPartnerOrgScope', () => {
  afterEach(() => jest.resetAllMocks());

  it('includes related org ids from the org document', async () => {
    mockedGetRelatedOrgIds.mockResolvedValue(['3', '2']);
    const scope = await getPartnerOrgScope({ orgId: '3', keyId: 'k' });
    expect([...scope].sort()).toEqual(['2', '3']);
  });

  it('falls back to the partner org id when no related orgs are found', async () => {
    mockedGetRelatedOrgIds.mockResolvedValue([]);
    const scope = await getPartnerOrgScope({ orgId: '3', keyId: 'k' });
    expect([...scope]).toEqual(['3']);
  });
});
