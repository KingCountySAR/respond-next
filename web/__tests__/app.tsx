/** The whole web app in jsdom, against the real activity actor over the simulated network. */
import { configure, fireEvent, render, screen } from '@testing-library/react';
import { MemoryPersistence, SyncClient } from '@sync/client';
import { activityProjector, activityRegistry, type ActivityViewer, type BootstrapResponse } from '@sync/domain';
import { Hub, MemoryStorage } from '@sync/server';
import { App } from '../src/shell/App';
import { viewerOf, type Session } from '../src/shell/auth';
import { COMMAND, CRT, activityArgs } from '../../packages/domain/__tests__/helpers';
import { SimNetwork, mulberry32 } from '../../test/integration/sim';

export { CRT };

// The whole app renders over a network with latency while other test files share the CPU: the
// default 1 s wait for findBy* is too tight.
configure({ asyncUtilTimeout: 5000 });

/** The site is CRT, so people signing in respond under CRT. */
export const site: BootstrapResponse = {
  config: { organization: { id: CRT.id, title: CRT.title, shortTitle: 'CRT' }, theme: { primary: '#336' }, dev: { noExternalNetwork: true, buildId: 'test' } },
};

export const ACTIVITY = 'a1';
export const TITLE = 'Lost hiker, Mailbox Peak';

/**
 * A server with one activity on it, set up by a command client (`seed`): Dana Field (kcsara:7)
 * staging under CRT. Each app rendered connects as its own client.
 */
export async function serverWithActivity() {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  const net = new SimNetwork(new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now }), mulberry32(1));
  net.latencyMs = 10;
  const seed = new SyncClient({ registry: activityRegistry, viewer: COMMAND, transport: net.transportFor(0, COMMAND) });
  await seed.start();
  await seed.open(ACTIVITY);
  seed.mutate(ACTIVITY, 'createActivity', activityArgs({ startTime: Date.now() - 60 * 60 * 1000, description: 'Hiker overdue since 1800.', mapId: 'ABC12' }));
  seed.mutate(ACTIVITY, 'addParticipant', { personRef: 'kcsara:7', firstname: 'Dana', lastname: 'Field', unit: CRT, status: 'staging' });

  let nextClient = 1;
  const renderApp = (path = '/') => {
    window.history.replaceState(null, '', path);
    const index = nextClient++;
    return render(<App bootstrap={async () => site} sync={{ transport: (s: Session) => net.transportFor(index, viewerOf(s) as ActivityViewer)(), persistence: () => new MemoryPersistence() }} />);
  };
  return { net, seed, renderApp, stop: () => seed.stop() };
}

export async function signIn(name: string, personRef: string, tier: 'field' | 'command' = 'field') {
  await screen.findByText('offline login');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Person'), { target: { value: personRef } });
  if (tier !== 'field') {
    fireEvent.mouseDown(screen.getByLabelText('Tier'));
    fireEvent.click(await screen.findByRole('option', { name: tier === 'command' ? 'Command' : 'Support' }));
  }
  fireEvent.click(screen.getByText('offline login'));
}
