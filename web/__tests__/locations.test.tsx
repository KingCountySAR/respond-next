// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { getActivity } from '@sync/domain';
import { SAVED_TRAILHEAD, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;

beforeEach(async () => {
  server = await serverWithActivity();
});

afterEach(() => {
  cleanup();
  server.stop();
});

/** Types into a MUI Autocomplete (focused, as when typing) and picks an option. */
async function pickLocation(scope: ReturnType<typeof within>, query: string, option: string) {
  const input = scope.getByRole('combobox', { name: 'Location' });
  input.focus();
  fireEvent.change(input, { target: { value: query } });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

const savedActivityLocation = async () => {
  await waitFor(() => expect(window.location.pathname).toMatch(/^\/mission\/[0-9a-f-]{36}$/));
  const id = window.location.pathname.split('/').at(-1)!;
  await server.seed.open(id);
  await waitFor(() => expect(getActivity(server.seed.snapshot(id))).toBeTruthy());
  return getActivity(server.seed.snapshot(id))!.location;
};

async function newMission(title: string) {
  server.renderApp('/mission/new');
  await signIn('Alice Adams', 'kcsara:101', 'command');
  fireEvent.change(await screen.findByLabelText('Name', { exact: false }), { target: { value: title } });
}

describe('saved locations', () => {
  it('picks an activity location from the catalog', async () => {
    await newMission('Overdue hiker');
    await pickLocation(within(document.body), 'mailbox', SAVED_TRAILHEAD.title);
    // Picked from the catalog, so the location is linked to it and the button edits it.
    expect(screen.getByRole('button', { name: 'Edit location' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save Mission' }));
    expect(await savedActivityLocation()).toEqual({ title: SAVED_TRAILHEAD.title, lat: SAVED_TRAILHEAD.lat, lon: SAVED_TRAILHEAD.lon, address: SAVED_TRAILHEAD.address, savedId: SAVED_TRAILHEAD.id });
  });

  it('saves a new location to the catalog from the dialog when asked', async () => {
    await newMission('Lost skier');
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByLabelText('Description')).toBeNull(); // the catalog's, edited on the admin page
    fireEvent.change(dialog.getByLabelText('Location Name', { exact: false }), { target: { value: 'Snoqualmie Pass' } });
    fireEvent.click(dialog.getByLabelText('Create Saved Location'));
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Save Mission' }));

    const location = await savedActivityLocation();
    const [entry] = await server.locations.search('snoqualmie');
    expect(entry).toMatchObject({ title: 'Snoqualmie Pass', description: '' });
    expect(location.savedId).toBe(entry!.id);
  });

  it('keeps a location for the activity only by default, unlinked', async () => {
    await newMission('Overdue hiker');
    await pickLocation(within(document.body), 'mailbox', SAVED_TRAILHEAD.title);
    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Update Saved Location')).toBeTruthy();
    fireEvent.change(dialog.getByLabelText('Address'), { target: { value: 'Lower lot' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Save Mission' }));

    expect(await savedActivityLocation()).toMatchObject({ address: 'Lower lot', savedId: null });
    expect((await server.locations.search('mailbox'))[0]).toEqual(SAVED_TRAILHEAD);
  });

  it('manages the catalog on the admin page', async () => {
    server.renderApp('/admin/locations');
    await signIn('Alice Adams', 'kcsara:101', 'command');
    expect(await screen.findByText('Locations', { selector: 'h4' })).toBeTruthy();

    // Edit, keeping the description the activity dialog doesn't show.
    await pickLocation(within(document.body), 'mailbox', SAVED_TRAILHEAD.title);
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe(SAVED_TRAILHEAD.description);
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe(`https://maps.google.com/maps?q=${SAVED_TRAILHEAD.lat},${SAVED_TRAILHEAD.lon}&output=embed`);
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Lot fills by 7am.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(async () => expect((await server.locations.search('mailbox'))[0]?.description).toBe('Lot fills by 7am.'));

    // New.
    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    fireEvent.change(screen.getByLabelText('Location Name', { exact: false }), { target: { value: 'Tiger Mountain' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(async () => expect((await server.locations.search('')).map((l) => l.title)).toEqual(['Mailbox Peak Trailhead', 'Tiger Mountain']));

    // Delete, after confirming.
    await pickLocation(within(document.body), 'tiger', 'Tiger Mountain');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect((await server.locations.search('')).map((l) => l.title)).toEqual(['Mailbox Peak Trailhead']));
  });
});
