// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { commLog, currentTarget, getActivity, participantIdFor, statusOf, teamStatusOf, type EquipmentRec, type GroupRec, type PlaceRec, type TeamRec } from '@sync/domain';
import { ACTIVITY, CRT, TITLE, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;

beforeEach(async () => {
  server = await serverWithActivity();
});

afterEach(() => {
  cleanup();
  server.stop();
});

const DANA = participantIdFor('kcsara:7');
const records = <T,>(type: string) => [...server.seed.snapshot(ACTIVITY).scan(type)] as T[];
const byName = <T extends { name: string }>(type: string, name: string) => records<T>(type).find((r) => r.name === name);

async function openDashboard() {
  server.renderApp(`/ops/${ACTIVITY}`);
  await signIn('Alice Adams', 'kcsara:101', 'command');
  await screen.findByText('Communications');
}

/** A panel by its title. */
const panel = (title: string) => within(screen.getByText(title, { selector: 'h6' }).closest('.MuiPaper-root') as HTMLElement);

/**
 * Drags `source` onto `target` with the pointer. jsdom has no layout, so the element under the
 * pointer is said to be `target`.
 */
function drag(source: HTMLElement, target: HTMLElement) {
  const elementFromPoint = document.elementFromPoint;
  document.elementFromPoint = () => target;
  try {
    fireEvent.pointerDown(source, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(source, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(source, { clientX: 40, clientY: 40, pointerId: 1 });
  } finally {
    document.elementFromPoint = elementFromPoint;
  }
}

/** The topmost dialog. */
const topDialog = async () => within((await screen.findAllByRole('dialog')).at(-1)!);

/** Picks an option of a MUI Select. */
async function choose(select: HTMLElement, option: string) {
  fireEvent.mouseDown(select);
  fireEvent.click(within(await screen.findByRole('listbox')).getByText(option));
}

function seedTeam(name = 'Team 1') {
  const id = `team-${name.replace(/\W/g, '')}`;
  server.seed.mutate(ACTIVITY, 'createTeam', { id, name });
  return id;
}

// Row and box actions show only on hover, as in the legacy app; hidden, they have no accessible name, so tests find them by label.
describe('ops dashboard', () => {
  it('shows the activity, the responder counts, the pool, places and weather', async () => {
    await openDashboard();
    expect(screen.getByRole('link', { name: TITLE }).getAttribute('href')).toBe(`/mission/${ACTIVITY}`);
    const available = screen.getByText('Available', { selector: '.MuiPaper-root div' }).previousElementSibling;
    expect(available?.textContent).toBe('1');
    expect(panel('Resources').getByText('Dana Field')).toBeTruthy();
    expect(panel('Teams').getByText('There are no active teams.')).toBeTruthy();
    const operations = panel('Operations');
    expect(operations.getByText('Command Post')).toBeTruthy();
    expect(operations.getByText('Field')).toBeTruthy();
    expect(await operations.findByText('41°F')).toBeTruthy(); // the activity location's forecast
    expect(operations.getByText('Hiker overdue since 1800.')).toBeTruthy();
    expect(document.title).toBe(`26-0123 ${TITLE} - Dashboard`);
  });

  it('adds a team, assigns by dragging, and sets its status', async () => {
    await openDashboard();
    fireEvent.click(panel('Teams').getByRole('button', { name: 'Add' }));
    const teamName = await panel('Teams').findByText('Team 1');
    const team = await waitFor(() => {
      const found = byName<TeamRec>('team', 'Team 1');
      if (!found) throw new Error('Team 1 not synced yet');
      return found;
    });

    drag(panel('Resources').getByText('Dana Field'), teamName);
    await waitFor(() => expect(currentTarget(server.seed.snapshot(ACTIVITY), DANA)).toEqual({ kind: 'team', id: team.id }));
    // The first person on a team leads it, as the legacy app's first member did.
    await waitFor(() => expect(byName<TeamRec>('team', 'Team 1')?.leaderParticipantId).toBe(DANA));
    expect(statusOf(server.seed.snapshot(ACTIVITY), DANA)).toBe('assigned');
    expect(await panel('Resources').findByText('All responders are assigned.')).toBeTruthy();
    expect(panel('Teams').getByText('1 members')).toBeTruthy();

    await choose(panel('Teams').getByRole('combobox', { name: 'Team 1 status' }), 'On Scene');
    await waitFor(() => expect(teamStatusOf(server.seed.snapshot(ACTIVITY), team.id)).toBe('onScene'));
    // On scene counts as in the field.
    await waitFor(() => expect(screen.getByText('Field', { selector: '.MuiPaper-root div' }).previousElementSibling?.textContent).toBe('1'));

    // Dragged back to the pool, they're available again.
    drag(panel('Teams').getByText('Dana Field (CRT)'), panel('Resources').getByText('All responders are assigned.'));
    await waitFor(() => expect(statusOf(server.seed.snapshot(ACTIVITY), DANA)).toBe('staging'));
    expect(currentTarget(server.seed.snapshot(ACTIVITY), DANA)).toBeNull();
  });

  it('asks who leads a team when its leader leaves two or more behind', async () => {
    const t = seedTeam('Team 1');
    const at = Date.now();
    const [avery, kai] = [
      ['kcsara:1', 'Avery'],
      ['kcsara:2', 'Kai'],
    ].map(([ref, firstname]) => {
      if (!ref || !firstname) throw new Error('fixture');
      server.seed.mutate(ACTIVITY, 'addParticipant', { personRef: ref, firstname, lastname: 'Lindqvist', unit: CRT, status: 'staging', at });
      return participantIdFor(ref!);
    });
    server.seed.mutate(ACTIVITY, 'assign', { participantId: DANA, target: { kind: 'team', id: t }, asLeader: true });
    for (const p of [avery, kai]) server.seed.mutate(ACTIVITY, 'assign', { participantId: p!, target: { kind: 'team', id: t } });
    await openDashboard();
    const pool = () => panel('Resources').getByText('All responders are assigned.');
    const leader = () => byName<TeamRec>('team', 'Team 1')?.leaderParticipantId;

    // Cancelled, nothing moves.
    drag(await panel('Teams').findByText('Dana Field (CRT)'), pool());
    let dialog = await topDialog();
    expect(dialog.getByText('Dana Field is leaving Team 1. Who leads it now?')).toBeTruthy();
    expect(dialog.getByRole('button', { name: 'Make leader' }).hasAttribute('disabled')).toBe(true); // nobody picked at first
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryAllByRole('dialog')).toEqual([]));
    expect(currentTarget(server.seed.snapshot(ACTIVITY), DANA)).toEqual({ kind: 'team', id: t });

    drag(panel('Teams').getByText('Dana Field (CRT)'), pool());
    dialog = await topDialog();
    fireEvent.click(dialog.getByLabelText('Kai Lindqvist'));
    fireEvent.click(dialog.getByRole('button', { name: 'Make leader' }));
    await waitFor(() => expect(currentTarget(server.seed.snapshot(ACTIVITY), DANA)).toBeNull());
    expect(leader()).toBe(kai);
  });

  it('edits a team, refusing a name another team has', async () => {
    seedTeam('Team 1');
    seedTeam('Team 2');
    await openDashboard();
    fireEvent.click(await panel('Teams').findByText('Team 2'));
    let dialog = await topDialog();
    fireEvent.change(dialog.getByLabelText('Team name'), { target: { value: 'team 1' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Team name already exists.')).toBeTruthy();

    fireEvent.change(dialog.getByLabelText('Team name'), { target: { value: 'Hasty' } });
    await choose(dialog.getByRole('combobox', { name: 'GAR' }), 'Red');
    dialog = await topDialog();
    fireEvent.change(dialog.getByLabelText('Assignment'), { target: { value: 'Segment 4' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(byName<TeamRec>('team', 'Hasty')).toMatchObject({ gar: 'red', assignment: 'Segment 4' }));
    // Red teams sort first.
    const names = panel('Teams').getAllByText(/^(Hasty|Team 1)$/).map((n) => n.textContent);
    expect(names).toEqual(['Hasty', 'Team 1']);
  });

  it('disbands a team with people on it, moving them where asked', async () => {
    const teamId = seedTeam('Team 1');
    server.seed.mutate(ACTIVITY, 'assign', { participantId: DANA, target: { kind: 'team', id: teamId } });
    server.seed.mutate(ACTIVITY, 'setTeamStatus', { teamId, status: 'onScene' });
    await openDashboard();

    await choose(await panel('Teams').findByRole('combobox', { name: 'Team 1 status' }), 'Disbanded');
    const dialog = await topDialog();
    expect(dialog.getByText('Disband Team 1')).toBeTruthy();
    fireEvent.click(dialog.getByLabelText('Move to a place'));
    fireEvent.click(dialog.getByRole('button', { name: 'Disband' }));

    const commandPost = byName<PlaceRec>('place', 'Command Post')!;
    await waitFor(() => expect(currentTarget(server.seed.snapshot(ACTIVITY), DANA)).toEqual({ kind: 'place', id: commandPost.id }));
    expect(teamStatusOf(server.seed.snapshot(ACTIVITY), teamId)).toBe('disbanded');
  });

  it('adds a place, checking its coordinates, and a group led by whoever is dropped on it', async () => {
    await openDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }));
    let dialog = await topDialog();
    fireEvent.change(dialog.getByLabelText('Place Name'), { target: { value: 'Road Closure' } });
    fireEvent.change(dialog.getByLabelText('Latitude'), { target: { value: '47.5' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Longitude is required when latitude is provided')).toBeTruthy();
    fireEvent.change(dialog.getByLabelText('Longitude'), { target: { value: '-121.7' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(byName<PlaceRec>('place', 'Road Closure')).toMatchObject({ lat: 47.5, lon: -121.7, notes: null }));
    expect(await panel('Operations').findByText('47.5, -121.7')).toBeTruthy(); // the copy chip

    fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
    dialog = await topDialog();
    const name = dialog.getByRole('combobox', { name: 'Group Name' });
    name.focus();
    fireEvent.change(name, { target: { value: 'Rescue Group' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    const groupTitle = await panel('Operations').findByText('Rescue Group');

    drag(panel('Resources').getByText('Dana Field'), groupTitle);
    await waitFor(() => expect(byName<GroupRec>('group', 'Rescue Group')?.leaderParticipantId).toBe(DANA));
    // Leading a group doesn't move them.
    expect(currentTarget(server.seed.snapshot(ACTIVITY), DANA)).toBeNull();
  });

  it('names a custom item when it is dropped, and summarizes what is staged', async () => {
    await openDashboard();
    const resources = panel('Resources');
    fireEvent.click(resources.getByRole('tab', { name: 'Equipment' }));
    drag(resources.getByText('Custom Item'), panel('Operations').getByText('Command Post'));

    const dialog = await topDialog();
    fireEvent.change(dialog.getByLabelText('Equipment Name', { exact: false }), { target: { value: 'Sat phone' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add' }));

    const commandPost = byName<PlaceRec>('place', 'Command Post')!;
    await waitFor(() => expect(records<EquipmentRec>('equipment')).toEqual([expect.objectContaining({ name: 'Sat phone', assignedTo: { kind: 'place', id: commandPost.id } })]));
    expect(await panel('Operations').findByText('1 - Sat phone')).toBeTruthy();

    // A catalog item needs no name.
    drag(resources.getByText('Litter'), panel('Operations').getByText('Field'));
    await waitFor(() => expect(records<EquipmentRec>('equipment').map((e) => e.name).sort()).toEqual(['Litter', 'Sat phone']));
  });

  it('logs, favorites, edits and deletes comms', async () => {
    await openDashboard();
    const comms = panel('Communications');
    const log = within(comms.getByRole('form', { name: 'Log communication' }));
    for (const [label, value] of [
      ['From', 'Command Post'],
      ['To', 'Team 1'],
    ]) {
      const input = log.getByRole('combobox', { name: label });
      input.focus();
      fireEvent.change(input, { target: { value } });
    }
    fireEvent.change(log.getByLabelText('Message'), { target: { value: 'LKP 47.4669, -121.6747' } });
    fireEvent.keyDown(log.getByLabelText('Message'), { key: 'Enter' });

    await waitFor(() => expect(commLog(server.seed.snapshot(ACTIVITY)).map((c) => [c.from, c.to, c.message])).toEqual([['Command Post', 'Team 1', 'LKP 47.4669, -121.6747']]));
    expect(await comms.findByText('47.4669, -121.6747')).toBeTruthy(); // copy chip
    expect((log.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('');

    fireEvent.click(comms.getByLabelText('favorite communication'));
    await waitFor(() => expect(commLog(server.seed.snapshot(ACTIVITY))[0]?.favorite).toBe(true));

    fireEvent.click(comms.getByLabelText('edit communication'));
    const edit = within(await comms.findByRole('form', { name: 'Edit communication' }));
    fireEvent.change(edit.getByLabelText('Message'), { target: { value: 'LKP confirmed' } });
    fireEvent.click(edit.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commLog(server.seed.snapshot(ACTIVITY))[0]?.message).toBe('LKP confirmed'));

    // Unstarred, it's Normal (2): the Important level hides it.
    fireEvent.click(comms.getByLabelText('unfavorite communication'));
    await waitFor(() => expect(commLog(server.seed.snapshot(ACTIVITY))[0]?.favorite).toBe(false));
    fireEvent.click(comms.getByLabelText('Important: starred only'));
    expect(await comms.findByText('Nothing at these levels.')).toBeTruthy();
    fireEvent.click(comms.getByLabelText('Normal: comms logged by hand, and starred'));
    expect(await comms.findAllByText('LKP confirmed')).not.toHaveLength(0); // the entry, and the print view's copy

    fireEvent.click(await comms.findByLabelText('delete communication'));
    fireEvent.click((await topDialog()).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(commLog(server.seed.snapshot(ACTIVITY))).toEqual([]));
    await waitFor(() => expect(comms.queryAllByText('LKP confirmed')).toEqual([]));
  });

  it('shows changes in the comms log by level, and stars them', async () => {
    seedTeam('Team 1');
    await openDashboard();
    await choose(panel('Teams').getByRole('combobox', { name: 'Team 1 status' }), 'In Transit');
    const comms = panel('Communications');
    // Team status is Auto (3), shown at the default 1–3; adding Dana (Audit, 4) isn't. Each line is also in the print view.
    const teamLine = 'Alice Adams set Team 1 from In Base to In Transit';
    expect(await comms.findAllByText(teamLine)).not.toHaveLength(0);
    expect(comms.queryAllByText(/Dana Field signed in/)).toEqual([]);

    fireEvent.click(comms.getByLabelText('Audit: every change'));
    expect(await comms.findAllByText(/Dana Field signed in as Available/)).not.toHaveLength(0);

    fireEvent.click(within(comms.getByText(teamLine, { selector: 'p' }).closest('.MuiStack-root') as HTMLElement).getByLabelText('favorite log line'));
    fireEvent.click(comms.getByLabelText('Important: starred only'));
    await waitFor(() => expect(comms.queryAllByText(/Dana Field signed in/)).toEqual([]));
    expect(comms.getAllByText(teamLine)).not.toHaveLength(0);
  });

  it('edits the description', async () => {
    await openDashboard();
    fireEvent.click(panel('Operations').getByLabelText('Edit description'));
    const dialog = await topDialog();
    fireEvent.change(dialog.getByLabelText('Description'), { target: { value: '  Found at the lake.  ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(getActivity(server.seed.snapshot(ACTIVITY))?.description).toBe('Found at the lake.'));
  });

  it('shows phones the counts and the teams, read-only', async () => {
    const teamId = seedTeam('Team 1');
    server.seed.mutate(ACTIVITY, 'assign', { participantId: DANA, target: { kind: 'team', id: teamId }, asLeader: true });
    // A phone-width screen.
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes('max-width:1023.95px') && !query.includes('min-width'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    try {
      server.renderApp(`/ops/${ACTIVITY}`);
      await signIn('Alice Adams', 'kcsara:101', 'command');
      fireEvent.click(await screen.findByText('Team 1'));
      expect(screen.getByText('Dana Field', { selector: 'p' })).toBeTruthy(); // the leader, as text
      expect(screen.queryByText('Communications')).toBeNull();
      expect(screen.queryByRole('combobox', { name: 'Team 1 status' })).toBeNull();
      expect(screen.getByText('In Base')).toBeTruthy();
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it("marks someone on a team who isn't assigned yet", async () => {
    const teamId = seedTeam('Team 1');
    server.seed.mutate(ACTIVITY, 'addParticipant', { personRef: 'kcsara:1', firstname: 'Avery', lastname: 'Lindqvist', unit: CRT, status: 'responding' });
    server.seed.mutate(ACTIVITY, 'assign', { participantId: participantIdFor('kcsara:1'), target: { kind: 'team', id: teamId }, asLeader: true });
    await openDashboard();
    const teams = panel('Teams');
    expect(await teams.findByLabelText('One or more team members are not assigned to the activity.')).toBeTruthy();
    fireEvent.click(teams.getByRole('button', { name: 'Set Assigned' }));
    const confirm = await topDialog();
    expect(confirm.getByText('Mark Avery Lindqvist as Assigned?')).toBeTruthy();
    fireEvent.click(confirm.getByRole('button', { name: /ok|yes|confirm/i }));
    await waitFor(() => expect(statusOf(server.seed.snapshot(ACTIVITY), participantIdFor('kcsara:1'))).toBe('assigned'));
  });

  it('takes someone off a team whatever their status', async () => {
    const teamId = seedTeam('Team 1');
    const avery = participantIdFor('kcsara:1');
    server.seed.mutate(ACTIVITY, 'addParticipant', { personRef: 'kcsara:1', firstname: 'Avery', lastname: 'Lindqvist', unit: CRT, status: 'responding' });
    server.seed.mutate(ACTIVITY, 'assign', { participantId: avery, target: { kind: 'team', id: teamId }, asLeader: true });
    await openDashboard();
    // Still responding, not assigned: dragged back to the pool, they leave the team all the same.
    drag(await panel('Teams').findByText('Avery Lindqvist (CRT)'), panel('Resources').getByText('Dana Field'));
    await waitFor(() => expect(currentTarget(server.seed.snapshot(ACTIVITY), avery)).toBeNull());
    expect(statusOf(server.seed.snapshot(ACTIVITY), avery)).toBe('responding');
  });
});
