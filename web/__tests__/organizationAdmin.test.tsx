// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { CRT, serverWithActivity, signIn } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>> | undefined;

afterEach(() => {
  cleanup();
  server?.stop();
});

const SITE_ADMIN = 'root@example.org';

async function start(options: { siteAdmins?: string[] } = {}) {
  server = await serverWithActivity(options);
  return server;
}

async function signInByEmail(email: string, name?: string) {
  fireEvent.click(await screen.findByText('Dev sign-in'));
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } });
  if (name) fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.click(screen.getByText('dev sign in'));
}

const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe('dev sign-in', () => {
  it("says why someone the directory doesn't know can't sign in, and takes them as a visitor with a name", async () => {
    (await start()).renderApp('/');
    await signInByEmail('pat@gmail.example');
    expect(await screen.findByText(/pat@gmail.example isn't in the member directory/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pat Visitor' } });
    fireEvent.click(screen.getByText('dev sign in'));
    fireEvent.click(await screen.findByLabelText('account of current user'));
    expect(within(screen.getByRole('menu')).getByText('Pat Visitor')).toBeTruthy();
    // Not an admin: no admin page.
    expect(within(screen.getByRole('menu')).queryByText('Organizations')).toBeNull();
  });
});

describe('organization admin', () => {
  it("lets an organization's admin change its settings but not its site", async () => {
    const { organizations, renderApp } = await start();
    renderApp('/');
    await signIn('Alice Adams', 'kcsara:101', 'command');
    fireEvent.click(await screen.findByLabelText('account of current user'));
    fireEvent.click(within(screen.getByRole('menu')).getByText('Organizations'));

    fireEvent.click(await screen.findByText('Cascade Rescue Team (CRT)'));
    // Only CRT is hers, and no member providers or site admins.
    expect(screen.queryByText('Ridgeline Mountain Rescue (RMR)')).toBeNull();
    expect(screen.queryByText('Member providers')).toBeNull();
    expect(field('Hostnames').disabled).toBe(true);
    expect(screen.queryByText('Delete')).toBeNull();

    fireEvent.change(field(/^Title/), { target: { value: 'Cascade Rescue' } });
    fireEvent.change(field(/^Primary color$/), { target: { value: '#123456' } });
    fireEvent.change(field(/^Member tags/), { target: { value: 'CRT Medical = MED\nCRT K9 = K9' } });
    fireEvent.change(field(/^Member tiers/), { target: { value: 'CRT Leader = boss' } });
    expect(screen.getByText('Not a tier (command, support or field): CRT Leader = boss')).toBeTruthy();
    fireEvent.change(field(/^Member tiers/), { target: { value: 'CRT Leader = Command' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Cascade Rescue (CRT)')).toBeTruthy();
    expect(organizations.get(CRT.id)).toMatchObject({ title: 'Cascade Rescue', brand: { primary: '#123456' }, memberTags: { 'CRT Medical': 'MED', 'CRT K9': 'K9' }, memberTiers: { 'CRT Leader': 'command' }, hostnames: ['crt.localhost'] });
  });

  it('lets site admins add organizations and member providers, with secrets kept back', async () => {
    const { organizations, renderApp } = await start({ siteAdmins: [SITE_ADMIN] });
    renderApp('/admin/organizations');
    await signInByEmail(SITE_ADMIN, 'Root Admin');

    // A provider with a secret: it's saved, and only said to be set.
    fireEvent.click(await screen.findByText('New member provider'));
    fireEvent.change(field(/^Id/), { target: { value: 'cedar' } });
    fireEvent.change(field(/^cedar URL/), { target: { value: 'https://cedar.test' } });
    fireEvent.change(field(/^Token URL/), { target: { value: 'https://hydra.test/oauth2/token' } });
    fireEvent.change(field(/^Client id/), { target: { value: 'sync' } });
    fireEvent.change(field(/^Client secret/), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getAllByText('Save')[0]!);
    fireEvent.click(await screen.findByText('https://cedar.test · unused'));
    expect(screen.getByText('Set. Leave empty to keep it.')).toBeTruthy();
    expect(field(/^Client secret/).value).toBe('');
    expect(organizations.memberProvider('cedar')?.config).toMatchObject({ clientSecret: 'hunter2' });
    fireEvent.click(screen.getByText('Cancel'));

    // A new organization, using it.
    fireEvent.click(screen.getByText('New'));
    fireEvent.change(field(/^Id/), { target: { value: 'org-k9' } });
    fireEvent.change(field(/^Title/), { target: { value: 'Valley K9' } });
    fireEvent.change(field(/^Short title/), { target: { value: 'K9' } });
    fireEvent.change(field('Hostnames'), { target: { value: 'k9.localhost, k9.example.org' } });
    fireEvent.mouseDown(screen.getByLabelText('Member provider'));
    fireEvent.click(await screen.findByRole('option', { name: 'cedar' }));
    fireEvent.click(screen.getAllByText('Save')[0]!);
    expect(await screen.findByText('Valley K9 (K9)')).toBeTruthy();
    expect(organizations.get('org-k9')).toMatchObject({ hostnames: ['k9.localhost', 'k9.example.org'], memberProvider: 'cedar' });

    // The server's refusals are shown.
    fireEvent.click(screen.getByText('Valley K9 (K9)'));
    fireEvent.change(field('Hostnames'), { target: { value: 'crt.localhost' } });
    fireEvent.click(screen.getAllByText('Save')[0]!);
    expect(await screen.findByText('hostname crt.localhost belongs to both org-crt and org-k9')).toBeTruthy();
  });

  it('keeps site admins: those from the environment, and those stored', async () => {
    const { organizations, renderApp } = await start({ siteAdmins: [SITE_ADMIN] });
    renderApp('/admin/organizations');
    await signInByEmail(SITE_ADMIN, 'Root Admin');
    expect(await screen.findByText(`From SITE_ADMINS, always admins: ${SITE_ADMIN}`)).toBeTruthy();
    fireEvent.change(field(/^Site admins/), { target: { value: 'one@example.org\ntwo@example.org' } });
    fireEvent.click(screen.getByText('Save site admins'));
    await waitFor(() => expect(organizations.siteAdmins().stored).toEqual(['one@example.org', 'two@example.org']));
  });
});
