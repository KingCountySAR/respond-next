// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { currentUnitStatus, getActivity } from '@sync/domain';
import { activityArgs } from '../../packages/domain/__tests__/helpers';
import { ACTIVITY, TITLE, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;

beforeEach(async () => {
  server = await serverWithActivity();
  await server.seed.open('t1');
  server.seed.mutate('t1', 'createActivity', activityArgs({ kind: 'training', title: 'Rope rescue refresher', startTime: Date.now() + 24 * 60 * 60 * 1000 }));
});

afterEach(() => {
  cleanup();
  server.stop();
});

const section = async (name: string) => within(await screen.findByRole('region', { name }));

describe('ops home', () => {
  it('shows open missions and other events as cards, each opening its dashboard', async () => {
    server.renderApp('/ops');
    await signIn('Alice Adams', 'kcsara:101', 'manage');

    const missions = await section('Missions');
    const mission = (await missions.findByText(TITLE)).closest('a')!;
    expect(mission.getAttribute('href')).toBe(`/ops/${ACTIVITY}`);
    expect(within(mission).getByText('CRT 1')).toBeTruthy();
    // New Mission comes last, after the missions.
    const cards = missions.getAllByRole('link');
    expect(cards.at(-1)!.textContent).toBe('New Mission');

    const events = await section('Events');
    const training = (await events.findByText('Rope rescue refresher')).closest('a')!;
    expect(training.getAttribute('href')).toBe('/ops/t1');
    expect(within(training).getByText(/^[A-Z][a-z]{2} \d\d\/\d\d\/\d\d$/)).toBeTruthy(); // e.g. Sat 10/25/26
    expect(events.queryByText(TITLE)).toBeNull();
    expect(events.getAllByRole('link').at(-1)!.textContent).toBe('New Event');

    // A mission opened elsewhere shows without a refresh.
    await server.seed.open('m2');
    server.seed.mutate('m2', 'createActivity', activityArgs({ title: 'Injured climber, Exit 38', startTime: Date.now() }));
    expect(await missions.findByText('Injured climber, Exit 38')).toBeTruthy();
  });

  it("stands the site's unit down from a mission card's units menu, staying on the page", async () => {
    server.renderApp('/ops');
    await signIn('Alice Adams', 'kcsara:101', 'manage');
    const mission = (await (await section('Missions')).findByText(TITLE)).closest('a')!;
    fireEvent.click(await within(mission).findByRole('button', { name: 'Unit status' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Stand Down' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Stand Down' }));

    await waitFor(() => expect(currentUnitStatus(server.seed.snapshot(ACTIVITY), 'org-crt')?.status).toBe('stoodDown'));
    expect(window.location.pathname).toBe('/ops');
    expect(await within(mission).findByTitle('Stood Down')).toBeTruthy();
  });

  it('creates a mission with the same form, and opens its dashboard', async () => {
    server.renderApp('/ops');
    await signIn('Alice Adams', 'kcsara:101', 'manage');
    fireEvent.click(await screen.findByText('New Mission'));
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/mission/new?then=ops'));

    fireEvent.change(screen.getByLabelText('Name', { exact: false }), { target: { value: 'Overdue climber' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Location Name', { exact: false }), { target: { value: 'Exit 38 trailhead' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Save Mission' }));

    await waitFor(() => expect(window.location.pathname).toMatch(/^\/ops\/[0-9a-f-]{36}$/));
    const id = window.location.pathname.split('/').at(-1)!;
    await server.seed.open(id);
    await waitFor(() => expect(getActivity(server.seed.snapshot(id))).toMatchObject({ kind: 'mission', title: 'Overdue climber', mode: 'full' }));
  });

  it('offers respond-tier members New Event only', async () => {
    server.renderApp('/ops');
    await signIn('Dana Field', 'kcsara:7');
    expect(await (await section('Missions')).findByText(TITLE)).toBeTruthy();
    expect(screen.queryByText('New Mission')).toBeNull();
    expect(screen.getByRole('link', { name: 'New Event' })).toBeTruthy();
  });

  it('crosses between an activity and its dashboard from the toolbar, and only managers get the way in', async () => {
    server.renderApp(`/mission/${ACTIVITY}`);
    await signIn('Alice Adams', 'kcsara:101', 'manage');
    fireEvent.click(await screen.findByRole('link', { name: 'Operations' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/ops/${ACTIVITY}`));
    // In ops, the title is the ops home and the button goes back.
    expect(screen.getByRole('link', { name: /Check-In$/ }).getAttribute('href')).toBe('/ops');
    fireEvent.click(await screen.findByRole('link', { name: 'Respond' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/mission/${ACTIVITY}`));
    expect(screen.getByRole('link', { name: /Check-In$/ }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Operations' }).getAttribute('href')).toBe(`/ops/${ACTIVITY}`);
  });

  it("doesn't offer respond-tier members the Operations button", async () => {
    server.renderApp(`/mission/${ACTIVITY}`);
    await signIn('Dana Field', 'kcsara:7');
    await screen.findAllByText(new RegExp(TITLE));
    expect(screen.queryByRole('link', { name: 'Operations' })).toBeNull();
  });
});
