// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ActivityKind } from '@sync/domain';
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
const RESPOND_DASHBOARD = 'The operations dashboard is for managers.';
const setKind = (kind: ActivityKind) => server.seed.mutate(ACTIVITY, 'updateActivity', { kind });

describe('tier grants', () => {
  it('lets a manager grant manage access on the mission to someone on its roster, and take it away', async () => {
    server.renderApp(`/mission/${ACTIVITY}`);
    await signIn('Alice Adams', 'kcsara:101', 'manage');
    await screen.findByText(`26-0123 ${TITLE}`);
    fireEvent.click(rosterCard('Dana Field'));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(await dialog.findByRole('button', { name: 'Grant manage access' }));
    expect(await dialog.findByRole('button', { name: 'Remove manage access' })).toBeTruthy();
    expect(await server.grants.get(DANA, ACTIVITY)).toMatchObject({ tier: 'manage', grantedBy: 'alice.adams@crt.example.org' });
    expect(await server.grants.forPerson(DANA)).toEqual({ [ACTIVITY]: 'manage' });

    fireEvent.click(dialog.getByRole('button', { name: 'Remove manage access' }));
    expect(await dialog.findByRole('button', { name: 'Grant manage access' })).toBeTruthy();
    expect(await server.grants.get(DANA, ACTIVITY)).toBeUndefined();
  });

  it("aren't offered to responders", async () => {
    server.renderApp(`/mission/${ACTIVITY}`);
    await signIn('Avery Lindqvist', 'kcsara:1');
    await screen.findByText(`26-0123 ${TITLE}`);
    fireEvent.click(rosterCard('Dana Field'));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Total Hours:')).toBeTruthy();
    expect(dialog.queryByRole('button', { name: 'Grant manage access' })).toBeNull();
  });

  it('count at once, without signing in again', async () => {
    server.renderApp(`/ops/${ACTIVITY}`);
    await signIn('Dana Field', DANA);
    expect(await screen.findByText(RESPOND_DASHBOARD)).toBeTruthy();
    await server.grantManage(DANA);
    // Their connection is closed; it reconnects as a manager here.
    expect(await screen.findByText('Communications')).toBeTruthy();
  });

  it("don't let them create missions", async () => {
    await server.grantManage(DANA);
    server.renderApp('/');
    await signIn('Dana Field', DANA);
    expect((await screen.findAllByText(TITLE)).length).toBeGreaterThan(0);
    expect(screen.queryByText('New Mission')).toBeNull();
  });

  it("don't count on other activities", async () => {
    await server.grantManage(DANA, 'another-activity');
    server.renderApp(`/ops/${ACTIVITY}`);
    await signIn('Dana Field', DANA);
    expect(await screen.findByText(RESPOND_DASHBOARD)).toBeTruthy();
  });
});

describe('trainings and other events', () => {
  it('are for members to manage, until one becomes a mission', async () => {
    setKind('training');
    server.renderApp(`/ops/${ACTIVITY}`);
    await signIn('Dana Field', DANA);
    expect(await screen.findByText('Communications')).toBeTruthy();
    setKind('mission');
    expect(await screen.findByText(RESPOND_DASHBOARD)).toBeTruthy();
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
    await signIn('Alice Adams', 'kcsara:101', 'manage');
    await screen.findByText(`26-0123 ${TITLE}`);
    fireEvent.click(rosterCard('Dana Field'));
    const dialog = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(dialog.getByText('Total Hours:')).toBeTruthy());
    expect(dialog.queryByRole('button', { name: 'Grant manage access' })).toBeNull();
  });
});
