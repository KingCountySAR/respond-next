import { Button, MenuItem, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import type { MemberProviderConfig, MemberProviderView } from '@sync/domain';

export interface MemberProviderFormProps {
  initial: MemberProviderView | undefined;
  /** The organizations using it; it can't be deleted while there are any. */
  usedBy: string[];
  onSave(provider: MemberProviderConfig): Promise<void>;
  onDelete?(): void;
  onClose(): void;
}

const UNITS_EXAMPLE = '{ "CRT": { "emailDomain": "crt.example.org", "members": [["Avery", "Lindqvist", "Field"]] } }';

/**
 * A member provider: cedar, or a fixture of fictional members. A cedar provider's client secret is
 * never shown; typing one replaces it, and leaving it empty keeps it.
 */
export function MemberProviderForm({ initial, usedBy, onSave, onDelete, onClose }: MemberProviderFormProps) {
  const [values, setValues] = useState(() => ({
    id: initial?.id ?? '',
    kind: initial?.kind ?? 'cedar',
    url: initial?.kind === 'cedar' ? initial.url : '',
    tokenUrl: initial?.kind === 'cedar' ? initial.tokenUrl : '',
    clientId: initial?.kind === 'cedar' ? initial.clientId : '',
    scope: initial?.kind === 'cedar' ? (initial.scope ?? '') : '',
    clientSecret: '',
    units: initial?.kind === 'fixture' ? JSON.stringify(initial.units, null, 2) : '',
  }));
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const text = (field: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const hasSecret = initial?.kind === 'cedar' && initial.hasClientSecret;

  const save = async () => {
    let provider: MemberProviderConfig;
    if (values.kind === 'cedar') {
      const { id, url, tokenUrl, clientId, scope, clientSecret } = values;
      provider = { id: id.trim(), kind: 'cedar', url: url.trim(), tokenUrl: tokenUrl.trim(), clientId: clientId.trim(), scope: scope.trim() || undefined, clientSecret: clientSecret || undefined };
    } else {
      let units: unknown;
      try {
        units = values.units.trim() ? JSON.parse(values.units) : {};
      } catch {
        setError('Members: not valid JSON');
        return;
      }
      provider = { id: values.id.trim(), kind: 'fixture', units: units as Extract<MemberProviderConfig, { kind: 'fixture' }>['units'] };
    }
    setError(undefined);
    setSaving(true);
    try {
      await onSave(provider);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2} component="form" onSubmit={(e) => (e.preventDefault(), void save())}>
      <Stack direction="row" spacing={2}>
        <TextField label="Id" helperText="Also the prefix of its people's person refs" value={values.id} onChange={text('id')} disabled={!!initial} required fullWidth />
        <TextField select label="Kind" value={values.kind} onChange={text('kind')} sx={{ width: 200 }}>
          <MenuItem value="cedar">cedar</MenuItem>
          <MenuItem value="fixture">Fixture (fictional)</MenuItem>
        </TextField>
      </Stack>
      {values.kind === 'cedar' ? (
        <>
          <TextField label="cedar URL" value={values.url} onChange={text('url')} required />
          <TextField label="Token URL" helperText="Hydra's token endpoint: <issuer>/oauth2/token" value={values.tokenUrl} onChange={text('tokenUrl')} required />
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
          <TextField label="Scope" helperText="Default: members.read d4h:members.read" value={values.scope} onChange={text('scope')} />
        </>
      ) : (
        <TextField label="Members" helperText={`By unit, e.g. ${UNITS_EXAMPLE}`} value={values.units} onChange={text('units')} multiline minRows={4} />
      )}
      {error && <div role="alert">{error}</div>}
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
