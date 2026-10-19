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

const DANA = 'kcsara:7';
const rosterCard = (name: string) => screen.getAllByText(name).map((el) => el.closest('button')).find(Boolean)!;
const FIELD_DASHBOARD = 'The operations dashboard is for command and support.';
const setKind = (kind: string) => server.seed.mutate(ACTIVITY, 'updateActivity', { kind });

describe('tier grants', () => {
  it('let command grant command on the mission to someone on its roster, and take it away', async () => {
    server.renderApp(`/mission/${ACTIVITY}`);
    await signIn('Alice Adams', 'kcsara:101', 'command');
    await screen.findByText(`26-0123 ${TITLE}`);
    fireEvent.click(rosterCard('Dana Field'));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(await dialog.findByRole('button', { name: 'Grant command' }));
    expect(await dialog.findByRole('button', { name: 'Remove command grant' })).toBeTruthy();
    expect(await server.grants.get(DANA, ACTIVITY)).toMatchObject({ tier: 'command', grantedBy: 'alice.adams@crt.example.org' });
    expect(await server.grants.forPerson(DANA)).toEqual({ [ACTIVITY]: 'command' });

    fireEvent.click(dialog.getByRole('button', { name: 'Remove command grant' }));
    expect(await dialog.findByRole('button', { name: 'Grant command' })).toBeTruthy();
    expect(await server.grants.get(DANA, ACTIVITY)).toBeUndefined();
  });

  it("aren't offered to field", async () => {
    server.renderApp(`/mission/${ACTIVITY}`);
    await signIn('Avery Lindqvist', 'kcsara:1');
    await screen.findByText(`26-0123 ${TITLE}`);
    fireEvent.click(rosterCard('Dana Field'));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Total Hours:')).toBeTruthy();
    expect(dialog.queryByRole('button', { name: 'Grant command' })).toBeNull();
  });

  it('count at once, without signing in again', async () => {
    server.renderApp(`/ops/${ACTIVITY}`);
    await signIn('Dana Field', DANA);
    expect(await screen.findByText(FIELD_DASHBOARD)).toBeTruthy();
    await server.grantCommand(DANA);
    // Their connection is closed; it reconnects as command here.
    expect(await screen.findByText('Communications')).toBeTruthy();
  });

  it("don't let them create missions", async () => {
    await server.grantCommand(DANA);
    server.renderApp('/');
    await signIn('Dana Field', DANA);
    expect((await screen.findAllByText(TITLE)).length).toBeGreaterThan(0);
    expect(screen.queryByText('New Mission')).toBeNull();
  });

  it("don't count on other activities", async () => {
    await server.grantCommand(DANA, 'another-activity');
    server.renderApp(`/ops/${ACTIVITY}`);
    await signIn('Dana Field', DANA);
    expect(await screen.findByText(FIELD_DASHBOARD)).toBeTruthy();
  });
});

describe('trainings and other events', () => {
  it('are for members to manage, until one becomes a mission', async () => {
    setKind('training');
    server.renderApp(`/ops/${ACTIVITY}`);
    await signIn('Dana Field', DANA);
    expect(await screen.findByText('Communications')).toBeTruthy();
    setKind('mission');
    expect(await screen.findByText(FIELD_DASHBOARD)).toBeTruthy();
  });

  it('may be created by members, though missions may not', async () => {
    server.renderApp('/');
    await signIn('Dana Field', DANA);
    expect(await screen.findByText('New Event')).toBeTruthy();
    expect(screen.queryByText('New Mission')).toBeNull();
  });
});

describe('the grant button', () => {
  it("isn't offered on trainings", async () => {
    setKind('training');
    server.renderApp(`/event/${ACTIVITY}`);
    await signIn('Alice Adams', 'kcsara:101', 'command');
    await screen.findByText(`26-0123 ${TITLE}`);
    fireEvent.click(rosterCard('Dana Field'));
    const dialog = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(dialog.getByText('Total Hours:')).toBeTruthy());
    expect(dialog.queryByRole('button', { name: 'Grant command' })).toBeNull();
  });
});
