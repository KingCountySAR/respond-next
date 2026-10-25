// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { currentParticipantStatus, participantIdFor } from '@sync/domain';
import { activityArgs } from '../../packages/domain/__tests__/helpers';
import { ACTIVITY, TITLE, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>>;

beforeEach(async () => {
  server = await serverWithActivity();
  // A training, so Events has something too.
  await server.seed.open('t1');
  server.seed.mutate('t1', 'createActivity', activityArgs({ kind: 'training', title: 'Rope rescue refresher', startTime: Date.now() + 24 * 60 * 60 * 1000 }));
});

afterEach(() => {
  cleanup();
  server.stop();
});

/** The card a heading belongs to. */
const card = (title: string, index = 0) => screen.getAllByText(title, { selector: 'h6' })[index]!.closest('.MuiCard-root') as HTMLElement;

describe('home', () => {
  it('lists your activity, missions and events from the summaries', async () => {
    server.renderApp('/');
    await signIn('Dana Field', 'kcsara:7');

    expect(await screen.findByText('My Activity')).toBeTruthy();
    // Dana's mission shows twice: under My Activity and under Missions, both with her status.
    await waitFor(() => expect(screen.getAllByText(TITLE, { selector: 'h6' })).toHaveLength(2));
    expect(within(card(TITLE, 1)).getByText('Available')).toBeTruthy();
    expect(within(card(TITLE, 1)).getByText('CRT 1')).toBeTruthy();
    expect(within(card(TITLE, 1)).getByText('In Progress')).toBeTruthy();

    const training = within(card('Rope rescue refresher'));
    expect(training.getByText('Not Started')).toBeTruthy();
    expect(training.getByText('Start Time')).toBeTruthy();
    expect(screen.queryByText('New Mission')).toBeNull(); // respond-tier members don't create activities yet
    expect(card(TITLE, 1).querySelector('a')?.getAttribute('href')).toBe(`/mission/${ACTIVITY}`);
  });

  it('changes status from a tile', async () => {
    server.renderApp('/');
    await signIn('Dana Field', 'kcsara:7');
    await waitFor(() => expect(screen.getAllByText(TITLE, { selector: 'h6' })).toHaveLength(2));
    const tile = within(card(TITLE, 1));
    fireEvent.click(await tile.findByRole('button', { name: 'Depart Base' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Depart Base' }));
    await waitFor(() => expect(currentParticipantStatus(server.seed.snapshot(ACTIVITY), participantIdFor('kcsara:7'))?.status).toBe('demobilizing'));
    // The summary follows, and the tile's chip with it.
    await waitFor(() => expect(within(card(TITLE, 1)).getByText('Demobilized')).toBeTruthy());
  });

  it('offers managers New Mission and New Event, and shows new activities without a refresh', async () => {
    server.renderApp('/');
    await signIn('Alice Adams', 'kcsara:101', 'manage');
    expect(await screen.findByText('New Mission')).toBeTruthy();
    expect(screen.getByText('New Event')).toBeTruthy();
    await screen.findByText(TITLE, { selector: 'h6' });

    await server.seed.open('m2');
    server.seed.mutate('m2', 'createActivity', activityArgs({ title: 'Injured climber, Exit 38', startTime: Date.now() }));
    expect(await screen.findByText('Injured climber, Exit 38', { selector: 'h6' })).toBeTruthy();
  });
});
