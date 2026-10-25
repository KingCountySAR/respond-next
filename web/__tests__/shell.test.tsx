// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ACTIVITY, TITLE, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;

beforeEach(async () => {
  server = await serverWithActivity();
});

afterEach(() => {
  cleanup();
  server.stop();
});

describe('web shell', () => {
  it('signs in, connects, opens an activity, and signs out', async () => {
    server.renderApp(`/mission/${ACTIVITY}`);
    await signIn('Dana Field', 'kcsara:7');

    expect(await screen.findByText('CRT Check-In')).toBeTruthy();
    expect(await screen.findByText(`26-0123 ${TITLE}`)).toBeTruthy();
    expect(await screen.findByTestId('CloudIcon')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('account of current user'));
    const menu = within(screen.getByRole('menu'));
    expect(menu.getByText('Dana Field')).toBeTruthy();
    fireEvent.click(menu.getByText('Sign Out'));
    expect(await screen.findByText('Dev sign-in')).toBeTruthy();
  });

  it("says an activity the server doesn't have isn't found", async () => {
    server.renderApp('/mission/no-such-mission');
    await signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByText('Activity not found')).toBeTruthy();
    expect(screen.queryByText('Loading activity...')).toBeNull();
  });

  it("reads a closed activity once, and goes live when it's reopened", async () => {
    server.seed.mutate(ACTIVITY, 'closeActivity', {});
    await waitFor(() => expect(server.seed.status.pending).toBe(0));
    const subscribers = async () => (await server.net.hub.actor(ACTIVITY)).subscriberCount;
    server.renderApp(`/mission/${ACTIVITY}`);
    await signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByText(`26-0123 ${TITLE}`)).toBeTruthy();
    expect(await subscribers()).toBe(1); // the seed only

    // Someone reopens it: the list says so, and the page subscribes.
    server.seed.mutate(ACTIVITY, 'reopenActivity', {});
    await waitFor(async () => expect(await subscribers()).toBe(2));
    server.seed.mutate(ACTIVITY, 'updateActivity', { title: 'Lost hikers' });
    expect(await screen.findByText('26-0123 Lost hikers')).toBeTruthy();
  });

  it('keeps the ops dashboard to managers', async () => {
    server.renderApp(`/ops/${ACTIVITY}`);
    await signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByText('The operations dashboard is for managers.')).toBeTruthy();
  });

  it('redirects legacy paths', async () => {
    server.renderApp(`/mission/${ACTIVITY}/ops`);
    await signIn('Dana Field', 'kcsara:7');
    await screen.findByText('The operations dashboard is for managers.');
    expect(window.location.pathname).toBe(`/ops/${ACTIVITY}`);
  });
});
