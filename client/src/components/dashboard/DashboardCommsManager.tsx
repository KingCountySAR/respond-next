import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { Box, IconButton, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState } from 'react';

import { useCommsCommands } from '@respond/lib/client/services/comms';
import { CommunicationsLogEntry } from '@respond/shared/types/operations';

import { useActivityContext } from '../activities/ActivityProvider';
import { Stack } from '../Material';

import { CommsAutomatedToggleButton } from './DashboardCommsAutomatedToggleButton';
import { DashboardCommsComposer } from './DashboardCommsComposer';
import { CommsFavoriteToggleButton } from './DashboardCommsFavoriteToggleButton';
import { DashboardCopyChip } from './DashboardCopyChip';
import { DashboardSearchBox } from './DashboardSearchBox';

function format24HourTime(value: number) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
}

const decimalDegrees = new RegExp('(\\d){1,3}\\.(\\d)*\\s*[,]?\\s*[+-]?(\\d){1,3}\\.(\\d)*', 'g');
const utmCoordinates = new RegExp('(\\d){1,2}([a-zA-Z]){1}\\s(\\d)*([EW])?\\s(\\d)*([NS])?', 'g');

const parseValues = (value: string): string[] => {
  const matches = new Set<string>();

  for (const regex of [decimalDegrees, utmCoordinates]) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(value)) !== null) {
      matches.add(match[0]);
    }
  }

  return Array.from(matches);
};

export function DashboardCommsManager() {
  const comms = useCommsCommands();
  const activity = useActivityContext();

  const [editingId, setEditingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [hideAutomated, setHideAutomated] = useState(false);

  const visibleCommunications = useMemo(() => (activity.comms ?? []).filter((entry) => !entry.isDeleted && (!showFavorites || entry.isFavorite) && (!hideAutomated || !entry.isAutomated)), [activity, showFavorites, hideAutomated]);

  const filteredCommunications = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return visibleCommunications;
    return visibleCommunications.filter((entry) => {
      const msg = (entry.message || '').toLowerCase();
      const from = (entry.from || '').toLowerCase();
      const to = (entry.to || '').toLowerCase();
      return msg.includes(q) || from.includes(q) || to.includes(q);
    });
  }, [visibleCommunications, searchQuery]);

  const toggleFavorite = (entry: CommunicationsLogEntry) => {
    comms.updateComm(activity.id, entry.id, { isFavorite: !entry.isFavorite });
  };

  const deleteEntry = (id: string) => {
    comms.updateComm(activity.id, id, { isDeleted: true });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <DashboardSearchBox onChange={setSearchQuery} placeholder="Search messages, to, or from..." sx={{ flex: 1 }} />
        <CommsAutomatedToggleButton onChange={setHideAutomated} />
        <CommsFavoriteToggleButton onChange={(isSelected) => setShowFavorites(isSelected)} />
      </Stack>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.5, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0, width: '100%' }}>
        {filteredCommunications.length === 0 ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No communications logged yet.
            </Typography>
          </Box>
        ) : (
          filteredCommunications.map((entry) => (
            <Paper key={entry.id} variant="outlined" sx={{ p: 1, bgcolor: entry.isFavorite ? (theme) => alpha(theme.palette.info.main, 0.08) : undefined }}>
              {editingId === entry.id ? <DashboardCommsComposer entry={entry} onSave={() => setEditingId(null)} onCancel={() => setEditingId(null)} /> : <DashboardCommsEntry entry={entry} onEdit={() => setEditingId(entry.id)} onFavorite={() => toggleFavorite(entry)} onDelete={() => deleteEntry(entry.id)} />}
            </Paper>
          ))
        )}
      </Box>
      <DashboardCommsComposer />
    </Box>
  );
}

function DashboardCommsEntry({ entry, onEdit, onFavorite, onDelete }: { entry: CommunicationsLogEntry; onEdit: () => void; onFavorite: () => void; onDelete: () => void }) {
  const copyValues = parseValues(entry.message);
  return (
    <Box sx={{ '&:hover .comm-action': { opacity: 1, visibility: 'visible' } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">
          {entry.from} → {entry.to}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          {entry.isFavorite ? (
            <IconButton className="comm-action" onClick={onFavorite} size="small" aria-label="edit communication" sx={{ opacity: 0, visibility: 'hidden', transition: 'opacity 180ms ease' }}>
              <StarIcon sx={{ fontSize: 16, color: '#d89e00' }} />
            </IconButton>
          ) : (
            <IconButton className="comm-action" onClick={onFavorite} size="small" aria-label="edit communication" sx={{ opacity: 0, visibility: 'hidden', transition: 'opacity 180ms ease' }}>
              <StarBorderIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <IconButton className="comm-action" onClick={onEdit} size="small" aria-label="edit communication" sx={{ opacity: 0, visibility: 'hidden', transition: 'opacity 180ms ease' }}>
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton className="comm-action" onClick={onDelete} size="small" aria-label="delete communication" sx={{ opacity: 0, visibility: 'hidden', transition: 'opacity 180ms ease' }}>
            <DeleteOutlineIcon sx={{ fontSize: 16, color: 'darkred' }} />
          </IconButton>
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
            {format24HourTime(entry.timestamp)}
          </Typography>
        </Stack>
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {entry.message}
      </Typography>
      {!!copyValues.length && copyValues.map((value) => <DashboardCopyChip key={value} value={value} />)}
    </Box>
  );
}
