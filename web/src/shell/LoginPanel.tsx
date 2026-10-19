import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState, type FormEvent } from 'react';
import type { Session, Tier } from '@sync/domain';
import { useSite } from './App';
import { useAuth } from './auth';

/**
 * The legacy login panel's layout. Google sign-in is still to come; a server with DEV_TOOLS offers
 * the dev sign-in instead, which looks the email up in the member directory like Google sign-in will,
 * taking the tier from their groups unless the developer picks one.
 */
export function LoginPanel() {
  const { devSignIn } = useAuth();
  const site = useSite();
  const [form, setForm] = useState({ email: '', name: '', personRef: '', tier: '' as Tier | '', class: 'member' as Session['class'] });
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const set = (field: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [field]: e.target.value });

  if (!site.devSignIn) {
    return (
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
        <Typography sx={{ mt: 4 }}>Sign-in isn't available yet.</Typography>
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

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
      <Stack spacing={2} component="form" onSubmit={submit} sx={{ width: 320, mt: 4 }}>
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoFocus required />
        <TextField label="Name" helperText="Only for someone not in the member directory, or with a person" value={form.name} onChange={set('name')} />
        <TextField label="Person" helperText="Optional: be this person ref (e.g. kcsara:85205) without the directory" value={form.personRef} onChange={set('personRef')} />
        <TextField select label="Tier" value={form.tier} onChange={set('tier')}>
          <MenuItem value="">From their groups</MenuItem>
          <MenuItem value="field">Field</MenuItem>
          <MenuItem value="support">Support</MenuItem>
          <MenuItem value="command">Command</MenuItem>
        </TextField>
        <TextField select label="Class" value={form.class} onChange={set('class')}>
          <MenuItem value="member">Member</MenuItem>
          <MenuItem value="external">External</MenuItem>
        </TextField>
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" disabled={busy}>
          dev sign in
        </Button>
      </Stack>
    </Box>
  );
}
