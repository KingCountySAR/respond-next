import { describe, expect, it } from 'vitest';
import { ACTIVITY_ARCHIVE_ID, ACTIVITY_LIST_ID, SYSTEM_VIEWER, activitySummary, type ActivitiesResponse, type ActivityResponse, type ActivityViewer } from '@sync/domain';
import { HIDDEN_VIEW, MapView, encode, recKey, type ServerMessage } from '@sync/core';
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

  it("keep a site's missions and other events from units that don't see them", async () => {
    const app = await setup();
    const owned = (id: string, kind: 'mission' | 'training') =>
      app.hub.pushAsSystem(id, SYSTEM_VIEWER, [{ name: 'createActivity', args: activityArgs({ kind, title: id, ownerOrgId: 'org-crt', startTime: Date.now() }) }]);
    await owned('event', 'training');
    await owned('mission', 'mission');
    for (const id of ['event', 'mission']) {
      const { records } = await app.hub.read(id, SYSTEM_VIEWER);
      await app.hub.pushAsSystem(ACTIVITY_ARCHIVE_ID, SYSTEM_VIEWER, [{ name: 'setActivitySummary', args: { id, summary: activitySummary(new MapView(new Map(records.map((r) => [recKey(r), r]))), id) } }]);
    }
    // RMR is under the same umbrella as CRT, but doesn't name CRT as a partner.
    const rowan = app.client('rmr.localhost');
    await rowan.signIn('rowan.pike@rmr.example.org');
    const listed = async () => (await rowan.json<ActivitiesResponse>('/api/activities')).body.data.map((s) => s.id).sort();
    expect(await listed()).toEqual([]);
    for (const id of ['a1', 'event', 'mission']) expect((await rowan.request(`/api/activities/${id}`)).status).toBe(404);

    // Once RMR is on one, it sees it.
    await app.hub.pushAsSystem('mission', SYSTEM_VIEWER, [{ name: 'setUnitStatus', args: { unit: { id: 'org-rmr', title: 'Ridgeline Mountain Rescue', rosterName: 'RMR' }, status: 'invited', at: Date.now() } }]);
    expect((await rowan.json<ActivityResponse>('/api/activities/mission')).body.view).toBe('respond:member');
    expect((await rowan.request('/api/activities/event')).status).toBe(404);

    // CRT names RMR as a partner, so sees its events.
    await app.hub.pushAsSystem('rmrEvent', SYSTEM_VIEWER, [{ name: 'createActivity', args: activityArgs({ kind: 'training', ownerOrgId: 'org-rmr', startTime: Date.now() }) }]);
    const bo = app.client();
    await bo.signIn('bo.okafor@crt.example.org');
    expect((await bo.request('/api/activities/rmrEvent')).status).toBe(200);
  });

  it("sync none of an event to a site that doesn't see it, and take no changes to it", async () => {
    const app = testApp();
    await app.hub.pushAsSystem('event', SYSTEM_VIEWER, [{ name: 'createActivity', args: activityArgs({ kind: 'training', ownerOrgId: 'org-crt', startTime: Date.now() }) }]);
    const received: ServerMessage[] = [];
    const rowan: ActivityViewer = { userId: 'rowan', tier: 'manage', class: 'member', personRef: 'kcsara:9', siteId: 'org-rmr' };
    const handlers = app.hub.connect({ viewer: rowan, send: (text) => received.push(JSON.parse(text) as ServerMessage), close: () => {} });
    handlers.message(encode({ t: 'hello', clientId: 'c1', build: 'test', subs: [{ activityId: 'event', since: 0 }] }));
    await new Promise((r) => setTimeout(r, 20));
    handlers.message(encode({ t: 'push', activityId: 'event', mutations: [{ id: 1, name: 'updateActivity', v: 1, args: { title: 'Mine now' }, clientTime: 0 }] }));
    await new Promise((r) => setTimeout(r, 20));

    expect(received.find((m) => m.t === 'reset')).toMatchObject({ view: HIDDEN_VIEW, records: [] });
    expect(received.filter((m) => m.t === 'reject').map((m) => m.t === 'reject' && m.reason)).toEqual(['not_found']);
  });

  it("say not found for an activity there isn't, and for the list scopes", async () => {
    const { client } = await setup();
    const bo = client();
    await bo.signIn('bo.okafor@crt.example.org');
    for (const id of ['nothing', ACTIVITY_LIST_ID, ACTIVITY_ARCHIVE_ID]) expect((await bo.request(`/api/activities/${encodeURIComponent(id)}`)).status).toBe(404);
  });
});
