// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { activityArgs } from '../../packages/domain/__tests__/helpers';
import { ACTIVITY, TITLE, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;

// The reports section (with the data grid) loads lazily; loading it here keeps that out of the first test's waits.
beforeAll(async () => {
  await import('../src/sections/reports');
});

beforeEach(async () => {
  server = await serverWithActivity();
  await server.seed.open('t1');
  server.seed.mutate('t1', 'createActivity', activityArgs({ kind: 'training', title: 'Rope rescue refresher', startTime: Date.now() + 24 * 60 * 60 * 1000 }));
});

afterEach(() => {
  cleanup();
  server.stop();
});

describe('activity list reports', () => {
  it('lists missions only, linked to each mission', async () => {
    server.renderApp('/reports/missions');
    await signIn('Dana Field', 'kcsara:7');
    const link = await screen.findByRole('link', { name: TITLE });
    expect(link.getAttribute('href')).toBe(`/mission/${ACTIVITY}`);
    expect(screen.queryByText('Rope rescue refresher')).toBeNull();
    expect(document.title).toBe('Mission List');
  });

  it('lists events, and shows new ones without a refresh', async () => {
    server.renderApp('/reports/events');
    await signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByRole('link', { name: 'Rope rescue refresher' })).toBeTruthy();
    expect(screen.queryByText(TITLE)).toBeNull();

    await server.seed.open('t2');
    server.seed.mutate('t2', 'createActivity', activityArgs({ kind: 'training', title: 'Navigation basics', startTime: Date.now() }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Navigation basics' })).toBeTruthy());
  });

  it('sends the legacy /mission path to the report', async () => {
    server.renderApp('/mission');
    await signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByRole('link', { name: TITLE })).toBeTruthy();
  });
});
