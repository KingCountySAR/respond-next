import CategoryIcon from '@mui/icons-material/Category';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { Badge, Box, Button, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useMemo, useState, type FormEvent } from 'react';
import { EQUIPMENT_CATALOG, CUSTOM_EQUIPMENT_TYPE_ID, type EquipmentType } from '@sync/domain';
import type { ManageParticipant } from '@sync/model';
import { observer, useManageActivity } from '@sync/model/react';
import { useDialogs, type MuiDialogProps } from '../../shell/dialogs';
import { AppDialog } from '../../shell/dialogs/AppDialog';
import { statusText } from '../../ui/status';
import { useChange } from '../../ui/useChange';
import { useAssignResponder } from './NewLeaderDialog';
import { Draggable, Droppable } from './dnd';
import { dropEquipment, type EquipmentDrag } from './drops';
import { isDeployable, roster, type RosterSort } from './opsRules';
import { DashboardBoxWithTitle, DashboardDraggableContainer, DashboardPanel, DashboardSearchBox, DashboardSortMenu, DashboardToggleButton } from './parts';
import { DashboardParticipantCard } from './People';

const SORTS: { value: RosterSort; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'lastName', label: 'Last name' },
  { value: 'firstName', label: 'First name' },
  { value: 'unit', label: 'Unit' },
];

/** Who and what can be assigned. Dropping someone or something here takes them off where they were. */
export const DashboardResourcesPanel = observer(function DashboardResourcesPanel() {
  const activity = useManageActivity();
  const change = useChange();
  const assign = useAssignResponder();
  const { confirm } = useDialogs();
  const [tab, setTab] = useState<'responders' | 'equipment'>('responders');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RosterSort>('status');
  const groups = roster(activity, query, sort);
  const available = activity.participants.filter((p) => p.status === 'staging' && !p.target).length;

  const handleDrop = async (item: ManageParticipant | EquipmentDrag, type: string, source?: string) => {
    if (type === 'participant') {
      const p = item as ManageParticipant;
      if (!p.target) return;
      // Dragged from a team, it's plainly meant; from the roster itself, it could be a slip, so ask.
      if (source === 'roster') {
        const after = p.status === 'assigned' ? ` They'll be ${statusText('staging')}.` : '';
        const ok = await confirm({ prompt: `Take ${p.name} off ${p.locationName}?${after}`, label: 'Unassign' });
        if (!ok) return;
      }
      // Whatever their status: someone on a team, place or group can always go back to the pool.
      assign(p, null);
    } else if (type === 'equipment') {
      change(() => dropEquipment(activity, item as EquipmentDrag, null));
    }
  };

  const card = (p: ManageParticipant) =>
    isDeployable(p) ? (
      <Draggable key={p.id} type="participant" item={p} source="roster">
        <DashboardParticipantCard participant={p} showStatus={sort !== 'status'} />
      </Draggable>
    ) : (
      <DashboardParticipantCard key={p.id} participant={p} showStatus={sort !== 'status'} />
    );

  return (
    <DashboardPanel title="Resources" grow>
      <Droppable accepts={['participant', 'equipment']} onDrop={handleDrop} grow>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" sx={{ minHeight: 36, height: 36 }}>
            <Tab
              icon={
                <Badge badgeContent={available} color="info" sx={{ m: 0.5 }}>
                  <PeopleAltIcon fontSize="small" />
                </Badge>
              }
              iconPosition="start"
              label={<Box sx={{ ml: 1 }}>Responders</Box>}
              value="responders"
              sx={{ minHeight: 42, py: 0, fontSize: '0.8125rem' }}
            />
            <Tab icon={<Inventory2Icon fontSize="small" />} iconPosition="start" label={<Box sx={{ ml: 1 }}>Equipment</Box>} value="equipment" sx={{ minHeight: 36, py: 0, fontSize: '0.8125rem' }} />
          </Tabs>
        </Box>

        {/* Kept mounted, so the search and sort survive a look at the equipment. */}
        <Box sx={{ display: tab === 'responders' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <DashboardSearchBox placeholder="Search names, units, tags..." onChange={setQuery} sx={{ flex: 1 }} />
              <DashboardSortMenu options={SORTS} value={sort} onChange={setSort} />
            </Stack>
            {groups.length === 0 ? (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                  {query.trim() ? 'No responders match.' : 'No one has responded yet.'}
                </Typography>
              </Box>
            ) : sort === 'lastName' || sort === 'firstName' ? (
              <Stack spacing={1} sx={{ overflow: 'auto' }}>
                {groups[0]!.people.map(card)}
              </Stack>
            ) : (
              <Stack spacing={1} sx={{ overflow: 'auto' }}>
                {groups.map((g) => (
                  <DashboardBoxWithTitle
                    key={g.key}
                    title={g.title}
                    collapsible
                    adornment={
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {g.people.length}
                      </Typography>
                    }
                  >
                    <Stack spacing={0.5}>{g.people.map(card)}</Stack>
                  </DashboardBoxWithTitle>
                ))}
              </Stack>
            )}
          </Box>
        </Box>
        {tab === 'equipment' && <DashboardEquipmentManager />}
      </Droppable>
    </DashboardPanel>
  );
});

const CATALOG = [...EQUIPMENT_CATALOG].sort((a, b) => a.name.localeCompare(b.name));

/** The catalog to drag from. Dropping the custom item asks for its name first. */
function DashboardEquipmentManager() {
  const { open } = useDialogs();
  const [query, setQuery] = useState('');
  const [byType, setByType] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? CATALOG.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) : CATALOG;
  }, [query]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, EquipmentType[]>();
    for (const t of filtered) byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t]);
    return [...byCategory].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // null (the dialog dismissed) cancels the drop.
  const nameItem = async (drag: EquipmentDrag): Promise<EquipmentDrag | null> => {
    if (!('typeId' in drag) || drag.typeId !== CUSTOM_EQUIPMENT_TYPE_ID) return drag;
    const name = await open(DashboardEquipmentCreateDialog, {});
    return name == null ? null : { ...drag, name };
  };

  const tile = (type: EquipmentType) => (
    <Draggable key={type.id} type="equipment" item={{ typeId: type.id } satisfies EquipmentDrag} transform={nameItem}>
      <DashboardDraggableContainer variant="compact">
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flex: 1, minWidth: 0, width: '100%' }}>
          <Typography variant="subtitle2">{type.name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {type.category}
          </Typography>
        </Stack>
      </DashboardDraggableContainer>
    </Draggable>
  );

  const grouping = byType ? 'Type' : 'All';
  return (
    <Stack spacing={2} sx={{ overflow: 'auto' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <DashboardSearchBox onChange={setQuery} sx={{ flex: 1 }} />
        <DashboardToggleButton on={byType} title={`Group by: ${grouping}`} label={`Group by ${byType ? 'All' : 'Type'}`} onClick={() => setByType((b) => !b)}>
          <CategoryIcon fontSize="small" />
        </DashboardToggleButton>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {byType
          ? groups.map(([category, types]) => (
              <DashboardBoxWithTitle key={category} title={category} collapsible>
                <Stack spacing={0.5}>{types.map(tile)}</Stack>
              </DashboardBoxWithTitle>
            ))
          : filtered.map(tile)}
      </Box>
    </Stack>
  );
}

/** Names a custom item; closes with the name. */
function DashboardEquipmentCreateDialog({ onClose }: MuiDialogProps<string>) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) setError('Name is required');
    else onClose(name.trim());
  };

  return (
    <AppDialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Custom Equipment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            label="Equipment Name"
            fullWidth
            required
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            error={!!error}
            helperText={error}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(null)} color="primary">
          Cancel
        </Button>
        <Button onClick={() => submit()} color="primary" variant="contained">
          Add
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
