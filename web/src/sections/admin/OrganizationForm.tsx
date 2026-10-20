import { Box, Button, Checkbox, FormControlLabel, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from 'react';
import { ICON_SIZES, type BrandIcons, type IconSize, type Organization, type OrganizationPartner } from '@sync/domain';
import { formatList, formatTags, parseList, parseTags, parseTiers, readAsDataUri } from './adminFields';

export interface OrganizationFormProps {
  initial: Organization;
  isNew: boolean;
  /** Site admins may change everything; an organization's admins, only its settings. */
  siteAdmin: boolean;
  /** Every organization, for parents and partners. */
  all: { id: string; title: string }[];
  memberProviders: string[];
  signInProviders: string[];
  onSave(org: Organization): Promise<void>;
  onDelete?(): void;
  onClose(): void;
}

/** Text as typed, turned into an Organization on save. */
interface Values {
  id: string;
  title: string;
  shortTitle: string;
  parentId: string;
  hostnames: string;
  emailDomains: string;
  memberProvider: string;
  signInProvider: string;
  providerUnit: string;
  memberTags: string;
  memberTiers: string;
  primary: string;
  primaryDark: string;
  /** The icons by size, plain and maskable. */
  icons: Record<'plain' | 'maskable', Partial<Record<IconSize, string>>>;
  canCreateMissions: boolean;
  canCreateEvents: boolean;
  partners: OrganizationPartner[];
  admins: string;
}

/** Only the sizes that have an icon. */
const bySize = (set: Partial<Record<IconSize, string>> | undefined) => Object.fromEntries(ICON_SIZES.filter((s) => set?.[s]).map((s) => [s, set![s]]));

const toValues = (o: Organization): Values => ({
  id: o.id,
  title: o.title,
  shortTitle: o.shortTitle,
  parentId: o.parentId ?? '',
  hostnames: formatList(o.hostnames),
  emailDomains: formatList(o.emailDomains),
  memberProvider: o.memberProvider ?? '',
  signInProvider: o.signInProvider ?? '',
  providerUnit: o.providerUnit ?? '',
  memberTags: formatTags(o.memberTags),
  memberTiers: formatTags(o.memberTiers),
  primary: o.brand?.primary ?? '',
  primaryDark: o.brand?.primaryDark ?? '',
  icons: { plain: bySize(o.brand?.icon), maskable: bySize(o.brand?.icon?.maskable) },
  canCreateMissions: o.canCreateMissions,
  canCreateEvents: o.canCreateEvents,
  partners: o.partners,
  admins: formatList(o.admins),
});

/** The icons as stored: none without a 512 one (the form won't save that). */
function iconsOf({ plain, maskable }: Values['icons']): BrandIcons | undefined {
  const masks = bySize(maskable);
  return plain[512] ? { ...bySize(plain), 512: plain[512], ...(Object.keys(masks).length && { maskable: masks }) } : undefined;
}

/** Icons given without the 512 one, which every other size falls back to. */
const missing512 = ({ plain, maskable }: Values['icons']) => !plain[512] && [...Object.values(plain), ...Object.values(maskable)].some(Boolean);

const fromValues = (v: Values): Organization => ({
  id: v.id.trim(),
  title: v.title,
  shortTitle: v.shortTitle,
  parentId: v.parentId || null,
  hostnames: parseList(v.hostnames),
  emailDomains: parseList(v.emailDomains),
  memberProvider: v.memberProvider || null,
  signInProvider: v.signInProvider || null,
  providerUnit: v.providerUnit.trim() || null,
  memberTags: parseTags(v.memberTags),
  memberTiers: parseTiers(v.memberTiers).rules,
  // Without a primary color, the organization takes its parent's brand.
  brand: v.primary.trim() ? { primary: v.primary.trim(), primaryDark: v.primaryDark.trim() || undefined, icon: iconsOf(v.icons) } : undefined,
  canCreateMissions: v.canCreateMissions,
  canCreateEvents: v.canCreateEvents,
  partners: v.partners,
  admins: parseList(v.admins),
});

export function OrganizationForm({ initial, isNew, siteAdmin, all, memberProviders, signInProviders, onSave, onDelete, onClose }: OrganizationFormProps) {
  const [values, setValues] = useState(() => toValues(initial));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Values>(field: K, value: Values[K]) => setValues((v) => ({ ...v, [field]: value }));
  const text = (field: keyof Values) => (e: { target: { value: string } }) => set(field, e.target.value as never);
  const others = all.filter((o) => o.id !== values.id);
  const badTiers = parseTiers(values.memberTiers).bad;
  const no512 = missing512(values.icons);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(fromValues(values));
    } finally {
      setSaving(false);
    }
  };

  const setIcon = (kind: 'plain' | 'maskable', size: IconSize, src: string | undefined) =>
    setValues((v) => ({ ...v, icons: { ...v.icons, [kind]: { ...v.icons[kind], [size]: src } } }));
  const pickIcon = async (kind: 'plain' | 'maskable', size: IconSize, file: File | undefined) => {
    if (file) setIcon(kind, size, await readAsDataUri(file));
  };

  const setPartner = (i: number, partner: OrganizationPartner) => set('partners', values.partners.map((p, j) => (j === i ? partner : p)));

  return (
    <Stack spacing={2} component="form" onSubmit={(e) => (e.preventDefault(), void save())}>
      {isNew && <TextField label="Id" helperText="Lowercase letters, digits and dashes; can't be changed" value={values.id} onChange={text('id')} required />}
      <Stack direction="row" spacing={2}>
        <TextField label="Title" value={values.title} onChange={text('title')} required fullWidth />
        <TextField label="Short title" value={values.shortTitle} onChange={text('shortTitle')} required sx={{ width: 160 }} />
      </Stack>

      <Typography variant="h6">Site</Typography>
      <TextField select label="Parent" value={values.parentId} onChange={text('parentId')} disabled={!siteAdmin}>
        <MenuItem value="">(none)</MenuItem>
        {others.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.title}
          </MenuItem>
        ))}
      </TextField>
      <TextField label="Hostnames" helperText="The site's addresses, separated by commas" value={values.hostnames} onChange={text('hostnames')} disabled={!siteAdmin} />
      <TextField label="Email domains" helperText="Its people's email domains: signing in with one uses this organization's member provider" value={values.emailDomains} onChange={text('emailDomains')} disabled={!siteAdmin} />
      <Stack direction="row" spacing={2}>
        <TextField select label="Member provider" value={values.memberProvider} onChange={text('memberProvider')} disabled={!siteAdmin} fullWidth>
          <MenuItem value="">(the parent's)</MenuItem>
          {memberProviders.map((id) => (
            <MenuItem key={id} value={id}>
              {id}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Unit in provider" helperText="Keeps searches to its members" value={values.providerUnit} onChange={text('providerUnit')} disabled={!siteAdmin} fullWidth />
      </Stack>
      <TextField select label="Sign-in provider" helperText="Where the site's people sign in" value={values.signInProvider} onChange={text('signInProvider')} disabled={!siteAdmin}>
        <MenuItem value="">(the parent's)</MenuItem>
        {signInProviders.map((id) => (
          <MenuItem key={id} value={id}>
            {id}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Member tags"
        helperText="What its members' groups show as on rosters, one per line: Group title = Label"
        value={values.memberTags}
        onChange={text('memberTags')}
        multiline
        minRows={2}
      />
      <TextField
        label="Member tiers"
        helperText={badTiers.length ? `Not a tier (command, support or field): ${badTiers.join('; ')}` : "The tier its members sign in at, from their groups, one per line: Group title = command (or support). Everyone else is field."}
        error={badTiers.length > 0}
        value={values.memberTiers}
        onChange={text('memberTiers')}
        multiline
        minRows={2}
      />

      <Typography variant="h6">Brand</Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <TextField label="Primary color" helperText="Empty: the parent's brand" value={values.primary} onChange={text('primary')} />
        <TextField label="Primary color, dark mode" value={values.primaryDark} onChange={text('primaryDark')} />
        <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: values.primary || 'transparent', border: 1, borderColor: 'divider' }} aria-label="color preview" />
      </Stack>
      <Typography variant="body2" color={no512 ? 'error' : 'text.secondary'}>
        App icons by size. 512 is needed; a size not given is made from the next larger one. Maskable icons keep their content to the
        middle 80%, for phones that crop icons to a shape; without any, the plain ones are used.
      </Typography>
      {(['plain', 'maskable'] as const).map((kind) => (
        <Stack key={kind} direction="row" spacing={2} sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 1 }}>
          <Typography sx={{ width: 80, pt: 1 }}>{kind === 'plain' ? 'Icon' : 'Maskable'}</Typography>
          {[...ICON_SIZES].reverse().map((size) => {
            const src = values.icons[kind][size];
            const label = `${kind === 'plain' ? '' : 'maskable '}${size} icon`;
            return (
              <Stack key={size} spacing={0.5} sx={{ alignItems: 'center', width: 96 }}>
                <Box sx={{ width: 48, height: 48, border: 1, borderColor: 'divider', borderRadius: 1, display: 'grid', placeItems: 'center' }}>
                  {src ? <img src={src} alt={label} width={48} height={48} style={{ objectFit: 'contain' }} /> : <Typography variant="caption" color="text.secondary">{size}</Typography>}
                </Box>
                <Button component="label" size="small">
                  {src ? 'Replace' : 'Choose'}
                  <input hidden type="file" accept="image/*" aria-label={`${label} file`} onChange={(e) => void pickIcon(kind, size, e.target.files?.[0])} />
                </Button>
                {src && (
                  <Button size="small" aria-label={`remove ${label}`} onClick={() => setIcon(kind, size, undefined)}>
                    Remove
                  </Button>
                )}
              </Stack>
            );
          })}
        </Stack>
      ))}

      <Typography variant="h6">Activities</Typography>
      <Stack direction="row">
        <FormControlLabel control={<Checkbox checked={values.canCreateMissions} onChange={(e) => set('canCreateMissions', e.target.checked)} />} label="Can create missions" />
        <FormControlLabel control={<Checkbox checked={values.canCreateEvents} onChange={(e) => set('canCreateEvents', e.target.checked)} />} label="Can create events" />
      </Stack>
      <Typography variant="subtitle1">Partners</Typography>
      <Typography variant="body2" color="text.secondary">
        Organizations under this one have these partners too. Their own entry for the same partner replaces this one.
      </Typography>
      {values.partners.map((p, i) => (
        <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField select label="Partner" value={p.id} onChange={(e) => setPartner(i, { ...p, id: e.target.value })} sx={{ minWidth: 240 }}>
            {others.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.title}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel control={<Checkbox checked={p.canCreateMissions} onChange={(e) => setPartner(i, { ...p, canCreateMissions: e.target.checked })} />} label="Missions" />
          <FormControlLabel control={<Checkbox checked={p.canCreateEvents} onChange={(e) => setPartner(i, { ...p, canCreateEvents: e.target.checked })} />} label="Events" />
          <IconButton aria-label="remove partner" onClick={() => set('partners', values.partners.filter((_, j) => j !== i))}>
            <DeleteIcon />
          </IconButton>
        </Stack>
      ))}
      <Box>
        <Button disabled={!others.length} onClick={() => set('partners', [...values.partners, { id: others[0]!.id, canCreateMissions: false, canCreateEvents: false }])}>
          Add partner
        </Button>
      </Box>

      <Typography variant="h6">Admins</Typography>
      <TextField label="Admins" helperText="Email addresses, separated by commas. They can change these settings, and those of organizations under this one." value={values.admins} onChange={text('admins')} multiline />

      <Stack direction="row" spacing={2}>
        <Button type="submit" variant="contained" disabled={saving || badTiers.length > 0 || no512}>
          Save
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        {onDelete && (
          <Button color="danger" onClick={onDelete}>
            Delete
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
