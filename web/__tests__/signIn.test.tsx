// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { serverWithActivity } from './app';

let server: Awaited<ReturnType<typeof serverWithActivity>> | undefined;

afterEach(() => {
  cleanup();
  server?.stop();
});

describe('the login panel', () => {
  it('offers Google where the site has a sign-in provider, coming back to the same page', async () => {
    server = await serverWithActivity({ devSignIn: false, googleSignIn: true });
    server.renderApp('/mission/a1');
    const google = await screen.findByRole('link', { name: 'Sign in with Google' });
    expect(google.getAttribute('href')).toBe(`/api/auth/login?then=${encodeURIComponent('/mission/a1')}`);
    expect(screen.queryByText('Dev sign-in')).toBeNull();
  });

  it('says why a sign-in was refused, once', async () => {
    server = await serverWithActivity({ devSignIn: false, googleSignIn: true });
    server.renderApp(`/?signinError=${encodeURIComponent("stranger@example.org isn't in the member directory.")}`);
    expect(await screen.findByText("stranger@example.org isn't in the member directory.")).toBeTruthy();
    expect(window.location.search).toBe('');
  });

  it("says sign-in isn't available without a provider or the dev sign-in", async () => {
    server = await serverWithActivity({ devSignIn: false });
    server.renderApp('/');
    expect(await screen.findByText("Sign-in isn't available yet.")).toBeTruthy();
  });

  it('offers both with DEV_TOOLS, the dev sign-in as a button that opens its form', async () => {
    server = await serverWithActivity({ googleSignIn: true });
    server.renderApp('/');
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.queryByLabelText(/^Email/)).toBeNull();
    fireEvent.click(screen.getByText('Dev sign-in'));
    expect(screen.getByLabelText(/^Email/)).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByLabelText(/^Email/)).toBeNull();
  });
});
