import { describe, expect, it } from 'vitest';
import { activityProjector, activityRegistry, type MemberInfo, type SiteConfig } from '@sync/domain';
import { Hub, MemoryStorage } from '@sync/server';
import { createSyncApp } from '../src/app';
import { FixtureDirectory, fixtureMembers } from '../src/members';

const site: SiteConfig = {
  organization: { id: 'org-crt', title: 'Cascade Rescue Team', shortTitle: 'CRT', canCreateMissions: true, canCreateEvents: true, partners: [] },
  theme: { primary: '#336' },
  dev: { noExternalNetwork: true, buildId: 'test' },
};

const members = fixtureMembers('crt', [
  ['Avery', 'Lindqvist', ['Field']],
  ['Kai', 'Lindqvist'],
  ['Bo', 'Okafor'],
]);

const { app } = createSyncApp(new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now }), {
  site,
  members: new FixtureDirectory({ 'org-crt': members }),
});

const get = async (path: string) => {
  const res = await app.request(path);
  return { status: res.status, body: (await res.json()) as { data?: MemberInfo[]; error?: string } };
};

describe('member routes', () => {
  it('finds members of a unit by name or email', async () => {
    const byName = await get('/api/v1/organizations/org-crt/members?query=lindq');
    expect(byName.status).toBe(200);
    expect(byName.body.data!.map((m) => [m.personRef, m.label])).toEqual([
      ['crt:1', 'Avery Lindqvist (avery.lindqvist@example.org)'],
      ['crt:2', 'Kai Lindqvist (kai.lindqvist@example.org)'],
    ]);
    expect((await get('/api/v1/organizations/org-crt/members?query=bo.okafor@')).body.data!.map((m) => m.name)).toEqual(['Bo Okafor']);
    expect((await get('/api/v1/organizations/org-crt/members?query=nobody')).body.data).toEqual([]);
  });

  it('holds the query to 3 to 100 characters, as the legacy route did', async () => {
    expect((await get('/api/v1/organizations/org-crt/members?query=li')).status).toBe(400);
    expect((await get(`/api/v1/organizations/org-crt/members?query=${'x'.repeat(101)}`)).status).toBe(400);
  });

  it('is not found for a unit without a directory, or a photo it lacks', async () => {
    expect((await get('/api/v1/organizations/org-other/members?query=lindq')).status).toBe(404);
    expect((await app.request('/api/v1/organizations/org-crt/members/1/photo')).status).toBe(404);
  });
});
