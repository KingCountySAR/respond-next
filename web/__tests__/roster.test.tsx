// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { participantIdFor } from '@sync/domain';
import { ACTIVITY, CRT, TITLE, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;
const HOUR = 60 * 60 * 1000;
const table = () => within(screen.getByRole('table'));

beforeEach(async () => {
  server = await serverWithActivity();
  const start = Date.now() - HOUR;
  server.seed.mutate(ACTIVITY, 'addParticipant', { personRef: 'kcsara:8', firstname: 'Sam', lastname: 'Rope', unit: CRT, status: 'responding', at: start + 60_000 });
  server.seed.mutate(ACTIVITY, 'setParticipantStatus', { participantId: participantIdFor('kcsara:8'), status: 'staging', unit: CRT, at: start + 120_000 });
});

afterEach(() => {
  cleanup();
  server.stop();
});

describe('roster report', () => {
  it('lists each stint, live, with its stamps', async () => {
    server.renderApp(`/reports/roster/${ACTIVITY}`);
    await signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByText('Sam Rope')).toBeTruthy();
    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(table().getAllByText(CRT.rosterName)).toHaveLength(2);
    // Dana was added straight to staging: her staging time stands in for a sign in.
    expect(table().getByText('Dana Field').closest('tr')!.querySelectorAll('h6')).toHaveLength(3); // two stamps and miles
    expect(table().queryByText('Ann Standby')).toBeNull();
    server.seed.mutate(ACTIVITY, 'addParticipant', { personRef: 'kcsara:9', firstname: 'Ann', lastname: 'Standby', unit: CRT, status: 'standby' });
    fireEvent.click(screen.getByLabelText('Include Standby'));
    expect(await table().findByText('Ann Standby')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Last Name, First Name'));
    expect(screen.getByText('Rope, Sam')).toBeTruthy();

    server.seed.mutate(ACTIVITY, 'setParticipantStatus', { participantId: participantIdFor('kcsara:8'), status: 'demobilizing', unit: CRT });
    await waitFor(() => expect(screen.getByText('Rope, Sam').closest('tr')!.querySelectorAll('h6')).toHaveLength(4)); // three stamps and miles
  });

  it('is linked from the activity page and the legacy path', async () => {
    server.renderApp(`/mission/roster/${ACTIVITY}`);
    await signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByText('Sam Rope')).toBeTruthy();
    expect(window.location.pathname).toBe(`/reports/roster/${ACTIVITY}`);
  });
});
