// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryPersistence, SyncClient } from '@sync/client';
import { activityProjector, activityRegistry, type BootstrapResponse } from '@sync/domain';
import { Hub, MemoryStorage } from '@sync/server';
import { App } from '../src/shell/App';
import { viewerOf, type Session } from '../src/shell/auth';
import { COMMAND, CRT, activityArgs } from '../../packages/domain/__tests__/helpers';
import { SimNetwork, mulberry32 } from '../../test/integration/sim';

const site: BootstrapResponse = {
  config: { organization: { title: 'Cascade Rescue Team', shortTitle: 'CRT' }, theme: { primary: '#336' }, dev: { noExternalNetwork: true, buildId: 'test' } },
};

let net: SimNetwork;
let seed: SyncClient;

beforeEach(async () => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  net = new SimNetwork(new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now }), mulberry32(1));
  net.latencyMs = 10;
  // Command sets up an activity with Dana on it, through the real activity actor.
  seed = new SyncClient({ registry: activityRegistry, viewer: COMMAND, transport: net.transportFor(0, COMMAND) });
  await seed.start();
  await seed.open('a1');
  seed.mutate('a1', 'createActivity', activityArgs({ startTime: Date.now() }));
  seed.mutate('a1', 'addParticipant', { personRef: 'kcsara:7', firstname: 'Dana', lastname: 'Field', unit: CRT, status: 'staging' });
});

afterEach(() => {
  cleanup();
  seed.stop();
});

const renderApp = () =>
  render(<App bootstrap={async () => site} sync={{ transport: (s: Session) => net.transportFor(1, viewerOf(s))(), persistence: () => new MemoryPersistence() }} />);

function signIn(name: string, personRef: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Person'), { target: { value: personRef } });
  fireEvent.click(screen.getByText('offline login'));
}

describe('web shell', () => {
  it('signs in, connects, opens an activity, and signs out', async () => {
    window.history.replaceState(null, '', '/mission/a1');
    renderApp();
    await screen.findByText('offline login');
    signIn('Dana Field', 'kcsara:7');

    expect(await screen.findByText('CRT Check-In')).toBeTruthy();
    expect(await screen.findByText('Lost hiker, Mailbox Peak')).toBeTruthy();
    expect(await screen.findByText('You: staging')).toBeTruthy();
    expect(await screen.findByTestId('CloudIcon')).toBeTruthy();
    expect(document.title).toBe('CRT Respond');

    fireEvent.click(screen.getByLabelText('account of current user'));
    const menu = within(screen.getByRole('menu'));
    expect(menu.getByText('Dana Field')).toBeTruthy();
    fireEvent.click(menu.getByText('Sign Out'));
    expect(await screen.findByText('offline login')).toBeTruthy();
  });

  it('keeps the ops dashboard to command and support', async () => {
    window.history.replaceState(null, '', '/ops/a1');
    renderApp();
    await screen.findByText('offline login');
    signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByText('The operations dashboard is for command and support.')).toBeTruthy();
  });

  it('redirects legacy paths', async () => {
    window.history.replaceState(null, '', '/mission/a1/ops');
    renderApp();
    await screen.findByText('offline login');
    signIn('Dana Field', 'kcsara:7');
    await screen.findByText('The operations dashboard is for command and support.');
    expect(window.location.pathname).toBe('/ops/a1');
  });
});
