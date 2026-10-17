import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { useState, type FormEvent } from 'react';
import type { Tier } from '@sync/domain';
import { useAuth, type Session } from './auth';

/**
 * The legacy login panel's layout. Google sign-in arrives in phase 2; until then the offline path
 * (the legacy "offline login") lets a developer say who they are.
 */
export function LoginPanel() {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ name: '', personRef: 'kcsara:', tier: 'field' as Tier, class: 'member' as Session['class'] });
  const set = (field: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [field]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim() || 'Dev User';
    const personRef = form.personRef.trim();
    signIn({ userId: `dev:${personRef || name}`, name, personRef, tier: form.tier, class: form.class });
  };

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
      <Stack spacing={2} component="form" onSubmit={submit} sx={{ width: 320, mt: 4 }}>
        <TextField label="Name" value={form.name} onChange={set('name')} autoFocus />
        <TextField label="Person" helperText="e.g. kcsara:85205, or adhoc:<id> for someone outside the unit" value={form.personRef} onChange={set('personRef')} />
        <TextField select label="Tier" value={form.tier} onChange={set('tier')}>
          <MenuItem value="field">Field</MenuItem>
          <MenuItem value="support">Support</MenuItem>
          <MenuItem value="command">Command</MenuItem>
        </TextField>
        <TextField select label="Class" value={form.class} onChange={set('class')}>
          <MenuItem value="member">Member</MenuItem>
          <MenuItem value="external">External</MenuItem>
        </TextField>
        <Button type="submit">offline login</Button>
      </Stack>
    </Box>
  );
}
