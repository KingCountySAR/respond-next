import { Alert, Box, Button, List, ListItemButton, ListItemText, Paper, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import type { AdminMemberProvidersResponse, AdminOrganizationsResponse, MemberProviderConfig, MemberProviderView, Organization, SiteAdminsResponse } from '@sync/domain';
import { useApi } from '../../shell/api';
import { useDialogs } from '../../shell/dialogs';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { parseList } from './adminFields';
import { MemberProviderForm } from './MemberProviderForm';
import { OrganizationForm } from './OrganizationForm';

const NEW_ORGANIZATION: Organization = {
  id: '',
  parentId: null,
  title: '',
  shortTitle: '',
  hostnames: [],
  emailDomains: [],
  memberProvider: null,
  providerUnit: null,
  memberTags: {},
  memberTiers: {},
  canCreateMissions: false,
  canCreateEvents: false,
  partners: [],
  admins: [],
};

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * `/admin/organizations`: organizations' settings for their admins; for site admins, every
 * organization, the member providers and the site admins too.
 */
export function OrganizationAdmin() {
  const api = useApi();
  const { alert, confirm } = useDialogs();
  const [data, setData] = useState<AdminOrganizationsResponse | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();
  const [selected, setSelected] = useState<Organization | 'new' | undefined>();

  const load = useCallback(() => api.admin.organizations().then(setData, (err) => setLoadError(message(err))), [api]);
  useEffect(() => {
    document.title = 'Organizations';
    void load();
  }, [load]);

  const report = (what: string) => (err: unknown) => alert({ title: what, message: message(err), type: 'error' });

  const save = async (org: Organization) => {
    try {
      await api.admin.saveOrganization(org);
      setSelected(undefined);
      await load();
    } catch (err) {
      await report('Not saved')(err);
    }
  };

  const remove = async (org: Organization) => {
    if (!(await confirm({ prompt: `Delete ${org.title}?`, destructive: true, label: 'Delete' }))) return;
    try {
      await api.admin.removeOrganization(org.id);
      setSelected(undefined);
      await load();
    } catch (err) {
      await report('Not deleted')(err);
    }
  };

  if (loadError) {
    return (
      <ToolbarPage>
        <Alert severity="error">{loadError}</Alert>
      </ToolbarPage>
    );
  }
  if (!data) return <ToolbarPage>Loading...</ToolbarPage>;
  const titleOf = (id: string | null) => data.all.find((o) => o.id === id)?.title;

  return (
    <ToolbarPage>
      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
          <Stack sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }} direction="row" spacing={2}>
            <Typography variant="h4">Organizations</Typography>
            {data.siteAdmin && (
              <Box>
                <Button disabled={!!selected} variant="outlined" onClick={() => setSelected('new')}>
                  New
                </Button>
              </Box>
            )}
          </Stack>
          {selected ? (
            <OrganizationForm
              key={selected === 'new' ? 'new' : selected.id}
              initial={selected === 'new' ? NEW_ORGANIZATION : selected}
              isNew={selected === 'new'}
              siteAdmin={data.siteAdmin}
              all={data.all}
              memberProviders={data.memberProviders}
              onSave={save}
              onDelete={data.siteAdmin && selected !== 'new' ? () => void remove(selected) : undefined}
              onClose={() => setSelected(undefined)}
            />
          ) : (
            <List>
              {data.organizations.map((o) => (
                <ListItemButton key={o.id} onClick={() => setSelected(o)}>
                  <ListItemText primary={`${o.title} (${o.shortTitle})`} secondary={[o.hostnames.join(', '), o.parentId && `under ${titleOf(o.parentId)}`].filter(Boolean).join(' · ')} />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>
        {data.siteAdmin && <MemberProviders onChange={load} />}
        {data.siteAdmin && <SiteAdmins />}
      </Stack>
    </ToolbarPage>
  );
}

function MemberProviders({ onChange }: { onChange(): void }) {
  const api = useApi();
  const { alert, confirm } = useDialogs();
  const [data, setData] = useState<AdminMemberProvidersResponse | undefined>();
  const [selected, setSelected] = useState<MemberProviderView | 'new' | undefined>();

  const load = useCallback(() => api.admin.memberProviders().then(setData, (err) => alert({ title: 'Member providers', message: message(err), type: 'error' })), [api, alert]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (provider: MemberProviderConfig) => {
    try {
      await api.admin.saveMemberProvider(provider);
      setSelected(undefined);
      await load();
      onChange();
    } catch (err) {
      await alert({ title: 'Not saved', message: message(err), type: 'error' });
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ prompt: `Delete member provider ${id}?`, destructive: true, label: 'Delete' }))) return;
    try {
      await api.admin.removeMemberProvider(id);
      setSelected(undefined);
      await load();
      onChange();
    } catch (err) {
      await alert({ title: 'Not deleted', message: message(err), type: 'error' });
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }} direction="row" spacing={2}>
        <Typography variant="h5">Member providers</Typography>
        <Box>
          <Button disabled={!!selected} variant="outlined" onClick={() => setSelected('new')}>
            New provider
          </Button>
        </Box>
      </Stack>
      {selected ? (
        <MemberProviderForm
          key={selected === 'new' ? 'new' : selected.id}
          initial={selected === 'new' ? undefined : selected}
          usedBy={selected === 'new' ? [] : (data?.usedBy[selected.id] ?? [])}
          onSave={save}
          onDelete={selected === 'new' ? undefined : () => void remove(selected.id)}
          onClose={() => setSelected(undefined)}
        />
      ) : (
        <List>
          {data?.memberProviders.map((p) => (
            <ListItemButton key={p.id} onClick={() => setSelected(p)}>
              <ListItemText primary={p.id} secondary={[p.kind === 'cedar' ? p.url : 'fixture', data.usedBy[p.id]?.length ? `used by ${data.usedBy[p.id]!.join(', ')}` : 'unused'].join(' · ')} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}

function SiteAdmins() {
  const api = useApi();
  const { alert } = useDialogs();
  const [data, setData] = useState<SiteAdminsResponse | undefined>();
  const [text, setText] = useState('');

  useEffect(() => {
    api.admin.siteAdmins().then(
      (d) => {
        setData(d);
        setText(d.stored.join('\n'));
      },
      (err) => alert({ title: 'Site admins', message: message(err), type: 'error' }),
    );
  }, [api, alert]);

  const save = async () => {
    try {
      const d = await api.admin.setSiteAdmins(parseList(text));
      setData(d);
      setText(d.stored.join('\n'));
    } catch (err) {
      await alert({ title: 'Not saved', message: message(err), type: 'error' });
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Site admins
      </Typography>
      {data && (
        <Stack spacing={2}>
          {data.fromEnvironment.length > 0 && <Typography color="text.secondary">From SITE_ADMINS, always admins: {data.fromEnvironment.join(', ')}</Typography>}
          <TextField label="Site admins" helperText="Email addresses, one per line" value={text} onChange={(e) => setText(e.target.value)} multiline minRows={2} />
          <Box>
            <Button variant="contained" onClick={() => void save()}>
              Save site admins
            </Button>
          </Box>
        </Stack>
      )}
    </Paper>
  );
}
