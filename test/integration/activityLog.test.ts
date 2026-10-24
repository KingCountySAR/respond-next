import { afterEach, describe, expect, it } from 'vitest';
import { SyncClient } from '@sync/client';
import type { ActivityClient } from '@sync/model';
import { Hub, MemoryStorage } from '@sync/server';
import { Level, activityLogId, activityProjector, activityRegistry, type ActivityViewer, type LogEntryRec } from '@sync/domain';
import { ActivityLogWriter } from '../../server/src/activityLog';
import { COMMAND, CRT, activityArgs, fieldMember } from '../../packages/domain/__tests__/helpers';
import { SimNetwork, mulberry32 } from './sim';

const ALICE: ActivityViewer = { ...COMMAND, name: 'Alice Adams' };
const ANNA: ActivityViewer = { ...fieldMember('kcsara:1'), name: 'Anna Lee' };

async function until(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(check()).toBe(true);
}

const clients: ActivityClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.stop()));

async function setup() {
  const log = new ActivityLogWriter(() => hub);
  const hub: Hub = new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now, onCommit: log.onCommit });
  const net = new SimNetwork(hub, mulberry32(5));
  net.latencyMs = 10;
  const [alice, anna] = [ALICE, ANNA].map((viewer, i) => new SyncClient({ registry: activityRegistry, viewer, transport: net.transportFor(i, viewer) }));
  for (const c of [alice!, anna!]) {
    await c.start();
    await c.open('a1');
    await c.open(activityLogId('a1'));
    clients.push(c);
  }
  const lines = (c: ActivityClient) => [...c.snapshot(activityLogId('a1')).scan<LogEntryRec>('logEntry')].sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1));
  const texts = (c: ActivityClient) => lines(c).map((l) => [l.level, l.text]);
  const synced = () => until(() => alice!.status.pending === 0 && anna!.status.pending === 0);
  return { hub, log, alice: alice!, anna: anna!, lines, texts, synced };
}

describe('the activity log', () => {
  it('says who changed what, team status and GAR at Auto and the rest at Audit', async () => {
    const s = await setup();
    const now = Date.now();
    s.alice.mutate('a1', 'createActivity', activityArgs({ startTime: now - 1000 }));
    s.alice.mutate('a1', 'addParticipant', { personRef: 'kcsara:1', firstname: 'Anna', lastname: 'Lee', unit: CRT, status: 'standby', at: now });
    s.alice.mutate('a1', 'addComm', { id: 'c1', from: 'Base', to: 'All', message: 'Briefing at 1500' });
    await s.synced();
    // Alice's changes are confirmed; Anna may not have them yet.
    await until(() => [...s.anna.snapshot('a1').scan('participant')].length === 1);
    const annaId = [...s.anna.snapshot('a1').scan<{ id: string; personRef: string } & { type: string; version: number }>('participant')][0]!.id;
    s.anna.mutate('a1', 'setParticipantStatus', { participantId: annaId, status: 'responding', unit: CRT, at: now + 1 });
    await s.synced();
    s.alice.mutate('a1', 'createTeam', { id: 't1', name: 'Team 1' });
    s.alice.mutate('a1', 'setTeamStatus', { teamId: 't1', status: 'inTransit', at: now + 2 });
    s.alice.mutate('a1', 'updateTeam', { id: 't1', gar: 'amber', notes: 'Upper trail' });
    s.alice.mutate('a1', 'createEquipment', { id: 'eq1', typeId: 'inventory-0', name: 'Sat phone', assignedTo: { kind: 'team', id: 't1' } });
    s.alice.mutate('a1', 'createEquipment', { id: 'eq2', typeId: 'inventory-0', name: 'Litter', assignedTo: null });
    await s.synced();

    await until(() => s.lines(s.alice).length === 10);
    // Timed changes carry their own time, the rest the server's, so the order here is loose.
    expect(s.texts(s.alice).sort()).toEqual([
      [4, 'Alice Adams created Lost hiker, Mailbox Peak'],
      [4, 'Alice Adams set CRT to Standby'],
      [4, 'Anna Lee signed in as Standby'],
      [4, 'Anna Lee moved from Standby to Responding'],
      [4, 'Alice Adams created Team 1'],
      [3, 'Alice Adams set Team 1 from In Base to In Transit'],
      [3, "Alice Adams set Team 1's GAR from Green to Amber"],
      [4, 'Alice Adams edited Team 1 (notes)'],
      [4, 'Alice Adams added Sat phone to Team 1'],
      [4, 'Alice Adams added Litter'],
    ].sort());
    // Alice signed Anna in, so that line says who did beside it; Anna's own change doesn't.
    const byline = (text: string) => s.lines(s.alice).find((l) => l.text === text)?.byline;
    expect(byline('Anna Lee signed in as Standby')).toBe(true);
    expect(byline('Anna Lee moved from Standby to Responding')).toBeUndefined();
  });

  it('is for command only, can be starred, and only the server writes it', async () => {
    const s = await setup();
    s.alice.mutate('a1', 'createActivity', activityArgs({ startTime: Date.now() - 1000 }));
    await until(() => s.lines(s.alice).length === 1);
    await s.synced();
    expect(s.lines(s.anna)).toEqual([]); // a field member on a mission

    s.alice.mutate(activityLogId('a1'), 'setLogFavorite', { id: s.lines(s.alice)[0]!.id, favorite: true });
    await until(() => s.lines(s.alice)[0]?.favorite === true && s.alice.status.pending === 0);
    // Refused here as on the server: only the server's own changes write lines.
    expect(() => s.alice.mutate(activityLogId('a1'), 'appendLog', { lines: [{ id: 'x', at: 1, by: 'Alice', text: 'Made up', level: Level.Auto, mutation: 'none' }] })).toThrow('Your role cannot make this change');
    expect(s.lines(s.alice).map((l) => l.text)).toEqual(['Alice Adams created Lost hiker, Mailbox Peak']);
  });

  it('makes members command on an event, there as on the event', async () => {
    const s = await setup();
    s.alice.mutate('a1', 'createActivity', activityArgs({ kind: 'training', startTime: Date.now() - 1000 }));
    await until(() => s.lines(s.anna).length === 1);
  });
});
