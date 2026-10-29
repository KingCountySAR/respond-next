// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { currentParticipantStatus, participantIdFor } from '@sync/domain';
import { ACTIVITY, CRT, RMR, TITLE, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;

beforeEach(async () => {
  server = await serverWithActivity();
});

afterEach(() => {
  cleanup();
  server.stop();
});

async function openAddDialog(name = 'Alice Adams', personRef = 'kcsara:101', tier: 'respond' | 'manage' = 'manage') {
  server.renderApp(`/mission/${ACTIVITY}`);
  await signIn(name, personRef, tier);
  await screen.findByText(`26-0123 ${TITLE}`);
  fireEvent.click(screen.getByRole('button', { name: 'Add Responder' }));
  return within(await screen.findByRole('dialog'));
}

/** Picks the unit, then searches for and picks a member. */
async function pick(dialog: ReturnType<typeof within>, unitTitle: string, query: string, label: RegExp) {
  fireEvent.mouseDown(dialog.getByRole('combobox', { name: 'Organization' }));
  fireEvent.click(await screen.findByRole('option', { name: unitTitle }));
  // The member search starts over (and enables) once the unit is set.
  const member = await waitFor(() => {
    const input = dialog.getByRole('combobox', { name: 'Member' });
    if (input.hasAttribute('disabled')) throw new Error('member search still disabled');
    return input;
  });
  // Focused, as when typing: MUI's Autocomplete resets an unfocused input when it re-renders.
  member.focus();
  fireEvent.change(member, { target: { value: query } });
  fireEvent.click(await screen.findByRole('option', { name: label }));
}

/** The status confirm, which opens over the Add dialog. */
const confirmDialog = async () => within((await screen.findAllByRole('dialog')).at(-1)!);

describe('add responder', () => {
  it('signs in a member found in the directory, under the unit picked', async () => {
    const dialog = await openAddDialog();
    expect(dialog.getByRole('combobox', { name: 'Member' }).hasAttribute('disabled')).toBe(true); // until a unit is picked
    await pick(dialog, CRT.title, 'lindq', /^Kai Lindqvist/);

    fireEvent.click(await dialog.findByRole('button', { name: 'Sign In' }));
    const confirm = await confirmDialog();
    fireEvent.click(confirm.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(currentParticipantStatus(server.seed.snapshot(ACTIVITY), participantIdFor('kcsara:2'))).toMatchObject({ status: 'responding', unitId: CRT.id }));
    // Their timeline shows once they're on the activity.
    expect(await dialog.findByText('Responding', { selector: 'h6' })).toBeTruthy();
  });

  it("shows someone's timeline and next steps when they're already on it", async () => {
    const dialog = await openAddDialog();
    await pick(dialog, CRT.title, 'dana', /^Dana Field/);
    expect(await dialog.findByText('Available', { selector: 'h6' })).toBeTruthy(); // her timeline
    expect(dialog.getByRole('button', { name: 'Depart Base' })).toBeTruthy();
  });

  it('warns when adding the first responder of a partner unit', async () => {
    const dialog = await openAddDialog();
    await pick(dialog, RMR.title, 'pike', /^Rowan Pike/);
    fireEvent.click(await dialog.findByRole('button', { name: /Sign In/ }));
    const confirm = await confirmDialog();
    expect(confirm.getByText(`You are the first responder for ${RMR.rosterName}, so this moves ${RMR.rosterName} to Responding. Make sure you are authorized to commit ${RMR.rosterName} to this mission.`)).toBeTruthy();
    fireEvent.click(confirm.getByRole('button', { name: /Sign In/ }));
    await waitFor(() => expect(currentParticipantStatus(server.seed.snapshot(ACTIVITY), participantIdFor('rmr:1'))?.unitId).toBe(RMR.id));
  });

  it('refuses a respond-tier member adding someone else, with the reason', async () => {
    const dialog = await openAddDialog('Dana Field', 'kcsara:7', 'respond');
    await pick(dialog, CRT.title, 'lindq', /^Avery Lindqvist/);
    fireEvent.click(await dialog.findByRole('button', { name: 'Sign In' }));
    fireEvent.click((await confirmDialog()).getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Not changed')).toBeTruthy();
  });
});
