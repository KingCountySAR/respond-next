// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { currentUnitStatus, getActivity } from '@sync/domain';
import { ACTIVITY, CRT, RMR, TITLE, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;

beforeEach(async () => {
  server = await serverWithActivity();
});

afterEach(() => {
  cleanup();
  server.stop();
});

const typeInto = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });

/** Picks a MUI select's option by the select's label. */
async function choose(label: string, option: string) {
  fireEvent.mouseDown(within(screen.getByText(label, { selector: 'label' }).parentElement!).getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('activity edit', () => {
  it('creates a mission with a new location, owned by a partner, from Home', async () => {
    server.renderApp('/');
    await signIn('Alice Adams', 'kcsara:101', 'command');
    fireEvent.click(await screen.findByText('New Mission'));
    expect(await screen.findByText(`${CRT.title} will start as a participating unit.`)).toBeTruthy();

    // The browser holds the form until the required fields are filled.
    fireEvent.click(screen.getByRole('button', { name: 'Save Mission' }));
    expect(window.location.pathname).toBe('/mission/new');

    typeInto('Name', 'Overdue climber');
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Location Name', { exact: false }), { target: { value: 'Exit 38 trailhead' } });
    fireEvent.change(dialog.getByLabelText('Lat (Decimal Degrees)'), { target: { value: '47.4' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }));
    expect(await dialog.findByText('Longitude is required')).toBeTruthy();
    fireEvent.change(dialog.getByLabelText('Lon (Decimal Degrees)'), { target: { value: '-121.6' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    typeInto('Map Id', 'https://caltopo.com/m/XYZ98');
    await choose('Responsible Agency', RMR.title);
    fireEvent.click(screen.getByRole('button', { name: 'Save Mission' }));

    // To the new mission's page, which has it already.
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/mission\/[0-9a-f-]{36}$/));
    expect(await screen.findByText('Overdue climber')).toBeTruthy();
    const id = window.location.pathname.split('/').at(-1)!;
    await server.seed.open(id);
    await waitFor(() => expect(getActivity(server.seed.snapshot(id))?.title).toBe('Overdue climber'));
    const view = server.seed.snapshot(id);
    expect(getActivity(view)).toMatchObject({ kind: 'mission', mapId: 'XYZ98', ownerOrgId: RMR.id, location: { title: 'Exit 38 trailhead', lat: 47.4, lon: -121.6, address: null } });
    expect(currentUnitStatus(view, CRT.id)?.status).toBe('responding');
    expect(currentUnitStatus(view, RMR.id)?.status).toBe('invited');
  });

  it('offers only units that may create the chosen type', async () => {
    server.renderApp('/event/new');
    await signIn('Alice Adams', 'kcsara:101', 'command');
    fireEvent.mouseDown(within((await screen.findByText('Responsible Agency', { selector: 'label' })).parentElement!).getByRole('combobox'));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([CRT.title]); // the partner creates missions only
  });

  it('edits an activity, reusing a listed location', async () => {
    server.renderApp(`/mission/${ACTIVITY}/edit`);
    await signIn('Alice Adams', 'kcsara:101', 'command');
    expect(await screen.findByDisplayValue(TITLE)).toBeTruthy();
    expect(screen.queryByText(/will start as a participating unit/)).toBeNull();
    typeInto('Name', 'Lost hikers, Mailbox Peak');
    await choose('Type', 'Event');
    fireEvent.click(screen.getByRole('button', { name: 'Save Event' }));

    await waitFor(() => expect(getActivity(server.seed.snapshot(ACTIVITY))?.title).toBe('Lost hikers, Mailbox Peak'));
    expect(getActivity(server.seed.snapshot(ACTIVITY))?.kind).toBe('training');
    expect(window.location.pathname).toBe(`/event/${ACTIVITY}`);
  });

  it("tells a field member they can't", async () => {
    server.renderApp(`/mission/${ACTIVITY}/edit`);
    await signIn('Dana Field', 'kcsara:7');
    expect(await screen.findByDisplayValue(TITLE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save Mission' }));
    expect(await screen.findByText('Not changed')).toBeTruthy();
    expect(window.location.pathname).toBe(`/mission/${ACTIVITY}/edit`);
  });
});
