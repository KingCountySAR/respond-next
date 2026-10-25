import { describe, expect, it } from 'vitest';
import { ACTIVITY_ARCHIVE_ID, ACTIVITY_LIST_ID, SYSTEM_VIEWER, activitySummary, type ActivitiesResponse, type ActivityResponse } from '@sync/domain';
import { MapView, recKey } from '@sync/core';
import { CRT, activityArgs } from '../../packages/domain/__tests__/helpers';
import { testApp } from './helpers';

const BO = 'kcsara:3';

/** A server with one activity Bo is on, summarized in the archive as the summary writer would. */
async function setup() {
  const app = testApp();
  const push = (name: string, args: Record<string, unknown>) => app.hub.pushAsSystem('a1', SYSTEM_VIEWER, [{ name, args: { at: Date.now(), ...args } }]);
  await push('createActivity', activityArgs({ startTime: Date.now() }));
  await push('addParticipant', { personRef: BO, firstname: 'Bo', lastname: 'Okafor', unit: CRT, status: 'responding' });
  const { records } = await app.hub.read('a1', SYSTEM_VIEWER);
  const summary = activitySummary(new MapView(new Map(records.map((r) => [recKey(r), r]))), 'a1');
  await app.hub.pushAsSystem(ACTIVITY_ARCHIVE_ID, SYSTEM_VIEWER, [{ name: 'setActivitySummary', args: { id: 'a1', summary } }]);
  return app;
}

describe('activities over HTTP', () => {
  it('need a session', async () => {
    const { client } = await setup();
    expect((await client().request('/api/activities')).status).toBe(401);
    expect((await client().request('/api/activities/a1')).status).toBe(401);
  });

  it("list every activity's summary from the archive", async () => {
    const { client } = await setup();
    const bo = client();
    await bo.signIn('bo.okafor@crt.example.org');
    const { status, body } = await bo.json<ActivitiesResponse>('/api/activities');
    expect(status).toBe(200);
    expect(body.data.map((s) => [s.id, s.activity.title])).toEqual([['a1', 'Lost hiker, Mailbox Peak']]);
    expect(body.data[0]).not.toHaveProperty('version');
  });

  it('read one activity as the viewer sees it there, a grant included', async () => {
    const { client, grants } = await setup();
    const bo = client();
    await bo.signIn('bo.okafor@crt.example.org');
    const respond = await bo.json<ActivityResponse>('/api/activities/a1');
    expect(respond.status).toBe(200);
    expect(respond.body).toMatchObject({ activityId: 'a1', version: 2, view: 'respond:member' });
    expect(respond.body.records.some((r) => r.type === 'activity')).toBe(true);

    await grants.set(BO, 'a1', { tier: 'manage', grantedBy: 'avery.lindqvist@crt.example.org', grantedAt: Date.now() });
    const granted = client();
    await granted.signIn('bo.okafor@crt.example.org');
    expect((await granted.json<ActivityResponse>('/api/activities/a1')).body.view).toBe('manage');
  });

  it("say not found for an activity there isn't, and for the list scopes", async () => {
    const { client } = await setup();
    const bo = client();
    await bo.signIn('bo.okafor@crt.example.org');
    for (const id of ['nothing', ACTIVITY_LIST_ID, ACTIVITY_ARCHIVE_ID]) expect((await bo.request(`/api/activities/${encodeURIComponent(id)}`)).status).toBe(404);
  });
});
