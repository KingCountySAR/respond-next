import { SyncClient, type Transport } from '@sync/client';
import { activityRegistry, participantIdFor, type ActivityViewer } from '@sync/domain';
import { Clock, CommandActivity } from '@sync/model';
import { COMMAND, CRT, HOUR, T0, activityArgs } from '../../domain/__tests__/helpers';

export { COMMAND, CRT, EXTERNAL, HOUR, T0, activityArgs, fieldMember } from '../../domain/__tests__/helpers';

export const ACTIVITY_ID = 'e1';

/** Never connects: every change stays local and pending, which is all the model needs to react. */
const offline = (): Transport => ({ open() {}, send() {}, close() {} });

export async function offlineClient(viewer: ActivityViewer = COMMAND): Promise<SyncClient> {
  const client = new SyncClient({ registry: activityRegistry, viewer, transport: offline });
  await client.open(ACTIVITY_ID);
  return client;
}

/** A clock whose time the test sets. */
export function testClock(start = T0 + 2 * HOUR) {
  let time = start;
  return { clock: new Clock(() => time, 1000), set: (t: number) => (time = t) };
}

/** An open activity with two people in staging and one team, as command, offline. */
export async function sampleActivity() {
  const client = await offlineClient();
  client.mutate(ACTIVITY_ID, 'createActivity', activityArgs());
  for (const [ref, first, last] of [
    ['kcsara:1', 'Anna', 'Lee'],
    ['kcsara:2', 'Ben', 'Okafor'],
  ] as const) {
    client.mutate(ACTIVITY_ID, 'addParticipant', { personRef: ref, firstname: first, lastname: last, unit: CRT, status: 'staging', at: T0 + HOUR });
  }
  client.mutate(ACTIVITY_ID, 'createTeam', { id: 't1', name: 'Team 1' });
  const { clock, set } = testClock();
  const activity = new CommandActivity(client, ACTIVITY_ID, { clock });
  return { client, activity, setTime: set, anna: participantIdFor('kcsara:1'), ben: participantIdFor('kcsara:2') };
}
