// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { currentParticipantStatus, currentUnitStatus, participantIdFor } from '@sync/domain';
import { ACTIVITY, TITLE, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;

beforeEach(async () => {
  server = await serverWithActivity();
});

afterEach(() => {
  cleanup();
  server.stop();
});

const dana = participantIdFor('kcsara:7');

async function openAs(name: string, personRef: string, tier?: 'manage') {
  server.renderApp(`/mission/${ACTIVITY}`);
  await signIn(name, personRef, tier);
  await screen.findByText(`26-0123 ${TITLE}`);
}

/** The roster card for a person (the card's clickable area). */
const rosterCard = (name: string) => screen.getAllByText(name).map((el) => el.closest('button')).find(Boolean)!;

describe('the activity page', () => {
  it('shows the briefing, units and roster', async () => {
    await openAs('Dana Field', 'kcsara:7');
    expect(screen.getByText('Hiker overdue since 1800.')).toBeTruthy();
    expect(screen.getByText('ABC12').closest('a')?.getAttribute('href')).toBe('https://caltopo.com/m/ABC12');
    expect(screen.getAllByText('In Progress')).toHaveLength(2); // the briefing and the manager panel
    expect(screen.getByText('CRT 1')).toBeTruthy();
    const card = within(rosterCard('Dana Field'));
    expect(card.getByText('Available')).toBeTruthy();
    expect(card.getByText(/^CRT/)).toBeTruthy();
  });

  it('changes your own status, and a manager sees it', async () => {
    await openAs('Dana Field', 'kcsara:7');
    fireEvent.click(screen.getByRole('button', { name: 'Depart Base' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(`Change your status for ${TITLE}?`)).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Depart Base' }));

    await waitFor(() => expect(within(rosterCard('Dana Field')).getByText('Demobilized')).toBeTruthy());
    await waitFor(() => expect(currentParticipantStatus(server.seed.snapshot(ACTIVITY), dana)?.status).toBe('demobilizing'));
  });

  it('signs in someone who is not on the activity yet', async () => {
    await openAs('Eli Ng', 'kcsara:9');
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(within(rosterCard('Eli Ng')).getByText('Responding')).toBeTruthy());
    // Responding keeps an ETA: the updater offers the preset buttons.
    expect(await screen.findByRole('button', { name: '15' })).toBeTruthy();
    await waitFor(() => expect(currentParticipantStatus(server.seed.snapshot(ACTIVITY), participantIdFor('kcsara:9'))?.unitId).toBe('org-crt'));
  });

  it('opens a participant with their hours and timeline', async () => {
    await openAs('Dana Field', 'kcsara:7');
    fireEvent.click(rosterCard('Dana Field'));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Total Hours:')).toBeTruthy();
    expect(dialog.getByText('Timeline')).toBeTruthy();
    expect(dialog.getAllByText('Available').length).toBeGreaterThan(0);
  });

  it("lets a manager change someone's status from their dialog, and shows who did", async () => {
    server.renderApp(`/mission/${ACTIVITY}`);
    await signIn('Alice Adams', 'kcsara:101', 'manage');
    await screen.findByText(`26-0123 ${TITLE}`);
    fireEvent.click(rosterCard('Dana Field'));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Depart Base' }));
    const form = within((await screen.findAllByRole('dialog')).at(-1)!);
    expect(form.getByText(`Change Dana's status for ${TITLE}?`)).toBeTruthy();
    fireEvent.click(form.getByRole('button', { name: 'Depart Base' }));

    await waitFor(() => expect(currentParticipantStatus(server.seed.snapshot(ACTIVITY), dana)).toMatchObject({ status: 'demobilizing', byName: 'Alice Adams' }));
    expect(await dialog.findByText('by Alice Adams')).toBeTruthy();
    expect(within(rosterCard('Dana Field')).getByTitle('Status set by Alice Adams')).toBeTruthy();
  });

  it("doesn't offer responders someone else's status", async () => {
    await openAs('Eli Ng', 'kcsara:9');
    fireEvent.click(rosterCard('Dana Field'));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByRole('button', { name: 'Depart Base' })).toBeNull();
  });

  it('refuses a responder completing the activity, with the reason', async () => {
    await openAs('Dana Field', 'kcsara:7');
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Complete' }));
    expect(await screen.findByText('Not changed')).toBeTruthy();
  });
});

describe('unit status', () => {
  it("lets a manager stand their organization down from the units menu, signing its members out", async () => {
    await openAs('Alice Adams', 'kcsara:101', 'manage');
    fireEvent.click(screen.getByText('CRT 1'));
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unit status' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Stand Down' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/signs out the person active under CRT/)).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Stand Down' }));

    await waitFor(() => expect(currentUnitStatus(server.seed.snapshot(ACTIVITY), 'org-crt')?.status).toBe('stoodDown'));
    expect(currentParticipantStatus(server.seed.snapshot(ACTIVITY), dana)?.status).toBe('clear');
    await waitFor(() => expect(screen.getByTitle('Stood Down').textContent).toMatch(/^CRT/));
  });

  it('lets a manager invite a partner outside their tree to a mission, once', async () => {
    await openAs('Alice Adams', 'kcsara:101', 'manage');
    fireEvent.click(screen.getByRole('button', { name: 'Unit status' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Invite unit…' }));
    const invite = within(await screen.findByRole('dialog'));
    fireEvent.click(invite.getByLabelText('RMR (Ridgeline Mountain Rescue)'));
    fireEvent.click(invite.getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(currentUnitStatus(server.seed.snapshot(ACTIVITY), 'org-rmr')?.status).toBe('invited'));
    await waitFor(() => expect(screen.getByTitle('Invited').textContent).toMatch(/^RMR/));

    // It's on now, and there's no one else.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Unit status' }));
    expect((await screen.findByRole('menuitem', { name: 'Invite unit…' })).classList).toContain('Mui-disabled');
  });

  it("doesn't offer responders the units menu", async () => {
    await openAs('Dana Field', 'kcsara:7');
    expect(screen.queryByRole('button', { name: 'Unit status' })).toBeNull();
  });
});
