import GoogleIcon from '@mui/icons-material/Google';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';
import type { Session, Tier } from '@sync/domain';
import { useSite } from './App';
import { useAuth } from './auth';

/** A refused or failed sign-in comes back as `?signinError=`: read once, then dropped from the URL. */
function takeSigninError(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('signinError') ?? undefined;
  if (error) {
    params.delete('signinError');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  }
  return error;
}

/**
 * The legacy login panel's layout: Google, through the site's sign-in provider, which comes back
 * here signed in. A server with DEV_TOOLS also offers the dev sign-in, a button that opens its form:
 * it looks the email up in the member directory as Google sign-in does, taking the tier from their
 * groups unless the developer picks one.
 */
export function LoginPanel() {
  const { devSignIn } = useAuth();
  const site = useSite();
  const [signinError] = useState(takeSigninError);
  const [form, setForm] = useState({ email: '', name: '', personRef: '', tier: '' as Tier | '', class: 'member' as Session['class'] });
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const set = (field: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [field]: e.target.value });

  const google = site.googleSignIn && (
    <Button variant="contained" startIcon={<GoogleIcon />} href={`/api/auth/login?then=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
      Sign in with Google
    </Button>
  );
  const refused = signinError && <Alert severity="error">{signinError}</Alert>;

  if (!site.devSignIn) {
    return (
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
        <Stack spacing={2} sx={{ width: 320, mt: 4 }}>
          {refused}
          {google || <Typography>Sign-in isn't available yet.</Typography>}
        </Stack>
      </Box>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await devSignIn({ email: form.email.trim(), name: form.name.trim() || undefined, personRef: form.personRef.trim() || undefined, tier: form.tier || undefined, class: form.class });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!devOpen) {
    return (
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
        <Stack spacing={2} sx={{ width: 320, mt: 4 }}>
          {refused}
          {google}
          <Button onClick={() => setDevOpen(true)}>Dev sign-in</Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
      <Stack spacing={2} component="form" onSubmit={submit} sx={{ width: 320, mt: 4 }}>
        {refused}
        {google}
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoFocus required />
        <TextField label="Name" helperText="Only for someone not in the member directory, or with a person" value={form.name} onChange={set('name')} />
        <TextField label="Person" helperText="Optional: be this person ref (e.g. kcsara:85205) without the directory" value={form.personRef} onChange={set('personRef')} />
        <TextField select label="Tier" value={form.tier} onChange={set('tier')}>
          <MenuItem value="">From their groups</MenuItem>
          <MenuItem value="respond">Respond</MenuItem>
          <MenuItem value="manage">Manage</MenuItem>
        </TextField>
        <TextField select label="Class" value={form.class} onChange={set('class')}>
          <MenuItem value="member">Member</MenuItem>
          <MenuItem value="external">External</MenuItem>
        </TextField>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={() => setDevOpen(false)}>Cancel</Button>
          <Button type="submit" variant="outlined" disabled={busy}>
            dev sign in
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
