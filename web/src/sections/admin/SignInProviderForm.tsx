import { Button, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import type { SignInProviderConfig, SignInProviderView } from '@sync/domain';

export interface SignInProviderFormProps {
  initial: SignInProviderView | undefined;
  /** The organizations using it; it can't be deleted while there are any. */
  usedBy: string[];
  onSave(provider: SignInProviderConfig): Promise<void>;
  onDelete?(): void;
  onClose(): void;
}

/**
 * A sign-in provider: a Google OAuth client, with each site's `https://<hostname>/api/auth/callback`
 * as a redirect URI. Its client secret is never shown; typing one replaces it, and leaving it empty
 * keeps it.
 */
export function SignInProviderForm({ initial, usedBy, onSave, onDelete, onClose }: SignInProviderFormProps) {
  const [values, setValues] = useState(() => ({ id: initial?.id ?? '', clientId: initial?.clientId ?? '', clientSecret: '' }));
  const [saving, setSaving] = useState(false);
  const text = (field: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const hasSecret = !!initial?.hasClientSecret;

  const save = async () => {
    const { id, clientId, clientSecret } = values;
    setSaving(true);
    try {
      await onSave({ id: id.trim(), kind: 'google', clientId: clientId.trim(), clientSecret: clientSecret || undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2} component="form" onSubmit={(e) => (e.preventDefault(), void save())}>
      <TextField label="Id" value={values.id} onChange={text('id')} disabled={!!initial} required />
      <Stack direction="row" spacing={2}>
        <TextField label="Client id" value={values.clientId} onChange={text('clientId')} required fullWidth />
        <TextField
          label="Client secret"
          type="password"
          autoComplete="new-password"
          helperText={hasSecret ? 'Set. Leave empty to keep it.' : 'Not set'}
          value={values.clientSecret}
          onChange={text('clientSecret')}
          required={!hasSecret}
          fullWidth
        />
      </Stack>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Button type="submit" variant="contained" disabled={saving}>
          Save
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        {onDelete && (
          <Button color="danger" onClick={onDelete} disabled={usedBy.length > 0} title={usedBy.length ? `Used by ${usedBy.join(', ')}` : undefined}>
            Delete
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
