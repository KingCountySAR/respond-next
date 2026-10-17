import { describe, expect, it } from 'vitest';
import { autorun } from 'mobx';
import { SyncClient } from '@sync/client';
import { ACTIVITY_LIST_ID, activityRegistry, activitySummary, participantIdFor } from '@sync/domain';
import { ActivityList } from '@sync/model';
import { HOUR, T0, testClock } from './helpers';
import { CRT, SYSTEM, addMember, startedActivity } from '../../domain/__tests__/helpers';

/** An offline client acting as the server, so it may write summaries into the list scope. */
async function listWith(...activities: [string, ReturnType<typeof startedActivity>][]) {
  const client = new SyncClient({ registry: activityRegistry, viewer: SYSTEM, transport: () => ({ open() {}, send() {}, close() {} }) });
  await client.open(ACTIVITY_LIST_ID);
  const write = (id: string, e: ReturnType<typeof startedActivity>) => client.mutate(ACTIVITY_LIST_ID, 'setActivitySummary', { id, summary: activitySummary(e.view, id) });
  for (const [id, e] of activities) write(id, e);
  const { clock, set } = testClock(T0 + 2 * HOUR);
  return { list: new ActivityList(client, { clock }), write, setTime: set };
}

describe('the activity list', () => {
  it('reads each summary: phase, active count and your own status', async () => {
    const mission = startedActivity();
    addMember(mission, 'kcsara:1', 'staging');
    const training = startedActivity({ kind: 'training', title: 'Rope day', startTime: T0 + 30 * HOUR });
    const { list } = await listWith(['m1', mission], ['t1', training]);

    expect(list.activities.map((a) => [a.id, a.isMission, a.phase])).toEqual([
      ['m1', true, 'inProgress'],
      ['t1', false, 'notStarted'],
    ]);
    const m = list.item('m1')!;
    expect(m.activeParticipantCount).toBe(1);
    expect(m.statusOf(participantIdFor('kcsara:1'))).toBe('staging');
    expect(m.units.map((u) => [u.rosterName, u.activeCount])).toEqual([['CRT', 1]]);
    expect(list.item('t1')!.startsInFuture).toBe(true);
  });

  it('keeps items and the list stable while summaries change', async () => {
    const mission = startedActivity();
    const { list, write } = await listWith(['m1', mission]);
    const item = list.item('m1');
    const lists: unknown[] = [];
    const stop = autorun(() => lists.push(list.activities));
    addMember(mission, 'kcsara:2', 'responding', CRT);
    write('m1', mission);
    expect(list.item('m1')).toBe(item);
    expect(item!.activeParticipantCount).toBe(1);
    expect(lists).toHaveLength(1);
    mission.run('removeActivity', { at: T0 + 2 * HOUR });
    write('m1', mission);
    expect(list.item('m1')).toBeUndefined();
    expect(lists).toHaveLength(2);
    stop();
  });
});
