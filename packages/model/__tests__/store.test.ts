import { describe, expect, it } from 'vitest';
import { autorun } from 'mobx';
import { HOUR, T0, sampleActivity } from './helpers';

describe('RecordStore', () => {
  it('holds the snapshot and follows it, deletes included', async () => {
    const { client, activity } = await sampleActivity();
    expect(activity.store.get('team', 't1')).toMatchObject({ name: 'Team 1' });
    expect([...activity.store.scan('participant')]).toHaveLength(2);
    client.mutate('e1', 'deleteTeam', { teamId: 't1', reassignTo: null, at: T0 + 2 * HOUR });
    expect(activity.store.get('team', 't1')).toBeUndefined();
  });

  it("scanWhere depends only on the matching records, so one person's change doesn't wake another's readers", async () => {
    const { client, activity, anna, ben } = await sampleActivity();
    let runs = 0;
    const stop = autorun(() => {
      [...activity.store.scanWhere('participantStatus', 'participantId', anna)];
      runs++;
    });
    expect(runs).toBe(1);
    activity.participant(ben)!.setStatus('clear', { at: T0 + 2 * HOUR });
    expect(runs).toBe(1);
    activity.participant(anna)!.setStatus('clear', { at: T0 + 2 * HOUR });
    expect(runs).toBe(2);
    stop();
  });

  it("doesn't rewrite pending records that come back equal on every snapshot", async () => {
    const { client, activity, anna, ben } = await sampleActivity();
    let runs = 0;
    const stop = autorun(() => {
      activity.store.get('participant', anna);
      runs++;
    });
    // Anna is pending (offline), so each snapshot rebuilds her record as a new object.
    client.mutate('e1', 'setEta', { participantId: ben, eta: T0 + 3 * HOUR });
    expect(runs).toBe(1);
    client.mutate('e1', 'setEta', { participantId: anna, eta: T0 + 3 * HOUR });
    expect(runs).toBe(2);
    stop();
  });
});
