import { describe, expect, it } from 'vitest';
import { autorun } from 'mobx';
import type { RespondActivityRec, SiteConfig, SiteUnit } from '@sync/domain';
import { ActivityDraft, EARLY_SIGN_IN_WINDOWS, mapIdOf, windowOf, windowValue, type EditedActivity } from '../src/sections/respond/activityDraft';

describe('early sign-in window choices', () => {
  it('round-trips every choice through the select, Open Immediately (null) included', () => {
    for (const { window } of EARLY_SIGN_IN_WINDOWS) expect(windowOf(windowValue(window))).toBe(window);
  });
});

/** A planned change's args, to read whichever fields it has. */
const args = (m: { args: object }) => m.args as Record<string, unknown>;

const unit = (id: string, missions: boolean, events: boolean): SiteUnit => ({ id, title: `${id.toUpperCase()} unit`, shortTitle: id.toUpperCase(), canCreateMissions: missions, canCreateEvents: events });
const org: SiteConfig['organization'] = { ...unit('crt', true, true), partners: [unit('rmr', true, false), unit('ev', false, true)] };
const NOW = 1_000_000;
const location = { title: 'Trailhead', lat: 47.4, lon: -121.6, address: null };

const record = (fields: Partial<RespondActivityRec> = {}): RespondActivityRec => ({
  type: 'activity',
  id: 'activity',
  version: 1,
  idNumber: '26-0001',
  kind: 'mission',
  title: 'Lost hiker',
  description: '',
  location,
  mapId: 'ABC',
  startTime: NOW - 1000,
  endTime: null,
  earlySignInWindow: null,
  ownerOrgId: 'crt',
  mode: 'full',
  standbyOnly: false,
  closed: false,
  removedAt: null,
  ...fields,
});

const edited = (fields: Partial<RespondActivityRec> = {}, units: string[] = ['crt']): EditedActivity => ({
  activityId: 'a1',
  record: record(fields),
  unit: (id) => (units.includes(id) ? { title: `${id} (listed)` } : undefined),
});

const filled = (draft: ActivityDraft) => {
  draft.set('title', 'Overdue climber');
  draft.set('location', location);
  return draft;
};

describe('activity draft', () => {
  it('starts a new one as the page type, owned by the first unit that may', () => {
    expect(new ActivityDraft(org, { missions: true, now: NOW })).toMatchObject({ isMission: true, ownerOrgId: 'crt', startTime: NOW, isNew: true });
    const event = new ActivityDraft({ ...org, canCreateEvents: false }, { missions: false, now: NOW });
    expect(event.ownerOrgId).toBe('ev');
  });

  it('offers the owners for the type, keeping the one picked when it can, and an unknown edited owner always', () => {
    const draft = new ActivityDraft(org, { missions: true, now: NOW });
    expect(draft.ownerChoices.map((o) => o.id)).toEqual(['crt', 'rmr']);
    draft.set('ownerOrgId', 'rmr');
    draft.set('isMission', false); // RMR can't own events
    expect(draft.ownerChoices.map((o) => o.id)).toEqual(['crt', 'ev']);
    expect(draft.ownerOrgId).toBe('crt');
    draft.set('ownerOrgId', 'ev');
    draft.set('isMission', true);
    expect(draft.ownerOrgId).toBe('crt'); // back to the type it started as: the first owner picked

    // Editing a partner's mission: as an event it needs another owner; back as a mission, when the
    // owner picked meanwhile can't own one, it returns to the partner rather than the first choice.
    const partners = new ActivityDraft(org, { missions: true, now: NOW, activity: edited({ ownerOrgId: 'rmr' }, ['crt', 'rmr']) });
    partners.set('isMission', false);
    expect(partners.ownerOrgId).toBe('crt');
    partners.set('ownerOrgId', 'ev');
    partners.set('isMission', true);
    expect(partners.ownerOrgId).toBe('rmr');

    const other = new ActivityDraft(org, { missions: true, now: NOW, activity: edited({ ownerOrgId: 'sheriff' }, ['crt', 'sheriff']) });
    expect(other.ownerChoices.at(-1)).toEqual({ id: 'sheriff', title: 'sheriff (listed)' });
    other.set('isMission', false);
    expect(other.ownerOrgId).toBe('sheriff');
  });

  it('is observable', () => {
    const draft = new ActivityDraft(org, { missions: true, now: NOW });
    const seen: string[][] = [];
    const stop = autorun(() => seen.push(draft.ownerChoices.map((o) => o.id)));
    draft.set('isMission', false);
    stop();
    expect(seen).toEqual([
      ['crt', 'rmr'],
      ['crt', 'ev'],
    ]);
  });

  it('refuses to save without a name, location or start time', () => {
    const draft = new ActivityDraft(org, { missions: true, now: NOW });
    draft.set('startTime', null);
    expect(draft.save(NOW, () => 'new')).toBeNull();
    expect(draft.errors).toEqual({ title: 'Name is required', location: 'Location is required', startTime: 'Invalid start time' });
    filled(draft).set('startTime', NOW);
    expect(draft.validate()).toBe(true);
    expect(draft.errors).toEqual({});
  });

  it('creates with the site unit responding, and invites a partner owner', () => {
    const draft = filled(new ActivityDraft(org, { missions: true, now: NOW }));
    draft.set('mapId', 'https://caltopo.com/m/XYZ98');
    draft.set('ownerOrgId', 'rmr');
    const plan = draft.save(NOW, () => 'new')!;
    expect(plan).toMatchObject({ activityId: 'new', isNew: true, path: '/mission/new' });
    expect(plan.mutations.map((m) => [m.name, args(m).status ?? args(m).title])).toEqual([
      ['createActivity', 'Overdue climber'],
      ['setUnitStatus', 'responding'],
      ['setUnitStatus', 'invited'],
    ]);
    expect(plan.mutations[0]!.args).toMatchObject({ kind: 'mission', mapId: 'XYZ98', ownerOrgId: 'rmr', mode: 'full' });
    expect(args(plan.mutations[2]!).unit).toEqual({ id: 'rmr', title: 'RMR unit', rosterName: 'RMR' });
  });

  it('puts the site unit on standby for an activity that starts later', () => {
    const draft = filled(new ActivityDraft(org, { missions: false, now: NOW }));
    draft.set('startTime', NOW + 60_000);
    expect(draft.startsAfter(NOW)).toBe(true);
    const plan = draft.save(NOW, () => 'new')!;
    expect(plan.path).toBe('/event/new');
    expect(plan.mutations.map((m) => args(m).status ?? args(m).kind)).toEqual(['training', 'standby']);
  });

  it('updates an edited one, keeping a non-mission kind and inviting a new owner', () => {
    const draft = new ActivityDraft(org, { missions: false, now: NOW, activity: edited({ kind: 'other' }) });
    expect(draft).toMatchObject({ isNew: false, isMission: false, title: 'Lost hiker' });
    draft.set('ownerOrgId', 'ev');
    const plan = draft.save(NOW, () => 'unused')!;
    expect(plan).toMatchObject({ activityId: 'a1', isNew: false, path: '/event/a1' });
    expect(plan.mutations.map((m) => m.name)).toEqual(['updateActivity', 'setUnitStatus']);
    expect(args(plan.mutations[0]!).kind).toBe('other');
    expect(new ActivityDraft(org, { missions: true, now: NOW, activity: edited() }).save(NOW, () => 'x')!.mutations.map((m) => m.name)).toEqual(['updateActivity']);
  });

  it('keeps only the map id from a CalTopo URL', () => {
    expect(mapIdOf(' https://caltopo.com/m/XYZ98 ')).toBe('XYZ98');
    expect(mapIdOf('ABC')).toBe('ABC');
  });
});
