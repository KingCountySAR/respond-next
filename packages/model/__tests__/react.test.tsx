// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component, StrictMode, type ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ActivityModelProvider, observer, useCommandActivity, useFieldActivity } from '@sync/model/react';
import type { FieldParticipant } from '@sync/model';
import { ACTIVITY_ID, CRT, HOUR, T0, activityArgs, fieldMember, offlineClient } from './helpers';
import { participantIdFor } from '@sync/domain';

afterEach(cleanup);

class Catch extends Component<{ children: ReactNode }, { error?: unknown }> {
  override state: { error?: unknown } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  override render() {
    return this.state.error ? <p>{String(this.state.error)}</p> : this.props.children;
  }
}

async function setup() {
  const client = await offlineClient();
  client.mutate(ACTIVITY_ID, 'createActivity', activityArgs());
  for (const [ref, first] of [
    ['kcsara:1', 'Anna'],
    ['kcsara:2', 'Ben'],
  ] as const) {
    client.mutate(ACTIVITY_ID, 'addParticipant', { personRef: ref, firstname: first, lastname: 'Lee', unit: CRT, status: 'staging', at: T0 + HOUR });
  }
  const renders: Record<string, number> = { list: 0 };

  const Card = observer(({ p }: { p: FieldParticipant }) => {
    renders[p.name] = (renders[p.name] ?? 0) + 1;
    return <li>{`${p.name}: ${p.status}`}</li>;
  });
  const Roster = observer(() => {
    const activity = useFieldActivity();
    renders.list!++;
    return (
      <ul>
        {activity.participants.map((p) => (
          <Card key={p.id} p={p} />
        ))}
      </ul>
    );
  });
  return { client, renders, Roster };
}

describe('ActivityModelProvider', () => {
  it('re-renders only the card whose person changed', async () => {
    const { client, renders, Roster } = await setup();
    render(
      <ActivityModelProvider client={client} activityId={ACTIVITY_ID} fallback={<p>Loading</p>}>
        <Roster />
      </ActivityModelProvider>,
    );
    expect(await screen.findByText('Anna Lee: staging')).toBeTruthy();
    // Let the observers subscribe (a passive effect) before changing anything. A change that lands
    // before then is still picked up, but by a re-render on subscribe, after the assertions below.
    await act(async () => {});
    const before = { ...renders };

    act(() => {
      client.mutate(ACTIVITY_ID, 'setParticipantStatus', { participantId: participantIdFor('kcsara:2'), unit: CRT, status: 'clear', at: T0 + 2 * HOUR });
    });
    expect(screen.getByText('Ben Lee: clear')).toBeTruthy();
    expect(renders['Ben Lee']).toBe(before['Ben Lee']! + 1);
    expect(renders['Anna Lee']).toBe(before['Anna Lee']);
    expect(renders.list).toBe(before.list);
  });

  it('shares one open activity through StrictMode remounts and closes it on unmount', async () => {
    const { client, Roster } = await setup();
    const open = vi.spyOn(client, 'open');
    const close = vi.spyOn(client, 'close');
    const view = render(
      <StrictMode>
        <ActivityModelProvider client={client} activityId={ACTIVITY_ID}>
          <Roster />
        </ActivityModelProvider>
      </StrictMode>,
    );
    await screen.findByText('Anna Lee: staging');
    await act(async () => {});
    expect(open).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();

    view.unmount();
    await act(async () => {});
    expect(close).toHaveBeenCalledWith(ACTIVITY_ID);
  });
});

describe('useCommandActivity', () => {
  const CommandOnly = observer(() => <p>{`${useCommandActivity().teams.length} teams`}</p>);

  it('gives command screens the command model', async () => {
    const { client } = await setup();
    render(
      <ActivityModelProvider client={client} activityId={ACTIVITY_ID}>
        <CommandOnly />
      </ActivityModelProvider>,
    );
    expect(await screen.findByText('0 teams')).toBeTruthy();
  });

  it('refuses field viewers', async () => {
    const client = await offlineClient(fieldMember('kcsara:9'));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs caught render errors
    render(
      <Catch>
        <ActivityModelProvider client={client} activityId={ACTIVITY_ID}>
          <CommandOnly />
        </ActivityModelProvider>
      </Catch>,
    );
    expect(await screen.findByText(/useCommandActivity is for command and support viewers/)).toBeTruthy();
    quiet.mockRestore();
  });
});
