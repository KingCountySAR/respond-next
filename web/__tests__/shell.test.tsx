// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
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

  it('keeps the ops dashboard to command and support', async () => {
    server.renderApp(`/ops/${ACTIVITY}`);
    await signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByText('The operations dashboard is for command and support.')).toBeTruthy();
  });

  it('redirects legacy paths', async () => {
    server.renderApp(`/mission/${ACTIVITY}/ops`);
    await signIn('Dana Field', 'kcsara:7');
    await screen.findByText('The operations dashboard is for command and support.');
    expect(window.location.pathname).toBe(`/ops/${ACTIVITY}`);
  });
});
