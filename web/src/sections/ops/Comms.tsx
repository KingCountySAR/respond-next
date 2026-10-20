import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PrintIcon from '@mui/icons-material/Print';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Fab,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useEffect, useRef, useState, type FormEvent, type HTMLAttributes, type Key, type ReactNode } from 'react';
import { useReactToPrint } from 'react-to-print';
import { COMM_PRIORITIES, DEFAULT_COMM_PRIORITY, type CommPriority } from '@sync/domain';
import type { Comm, LogLine } from '@sync/model';
import { observer, useActivityLog, useCommandActivity } from '@sync/model/react';
import { useSyncClient } from '../../shell/sync';
import { useDialogs } from '../../shell/dialogs';
import { useChange } from '../../ui/useChange';
import { commsContacts, coordinatesIn, filterComms, format24HourTime, isComm, mergeLog, type CommLevel, type LogItem } from './opsRules';
import { DashboardCopyChip, DashboardSearchBox } from './parts';

const PRIORITY_NAMES: Record<CommPriority, string> = { 1: 'Important', 2: 'Normal', 3: 'Routine' };

// Priority 1 alone is hidden for now.
const LEVELS: { value: CommLevel; label: ReactNode; title: string }[] = [
  { value: 'favorites', label: <StarIcon sx={{ fontSize: 18 }} />, title: 'Favorites only' },
  { value: 2, label: '2+', title: 'Priorities 1 and 2, and favorites' },
  { value: 3, label: '3+', title: 'Priorities 1 to 3: team status and GAR changes too' },
  { value: 4, label: '4+', title: 'Everything, every change included' },
];

// The level last picked, in this browser.
const LEVEL_KEY = 'comms-level';
function storedLevel(): CommLevel {
  try {
    const saved = localStorage.getItem(LEVEL_KEY);
    return LEVELS.find((l) => String(l.value) === saved)?.value ?? 3;
  } catch {
    return 3;
  }
}
function storeLevel(level: CommLevel): void {
  try {
    localStorage.setItem(LEVEL_KEY, String(level));
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

export const DashboardCommsManager = observer(function DashboardCommsManager() {
  const activity = useCommandActivity();
  const change = useChange();
  const { confirm } = useDialogs();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<CommLevel>(storedLevel);
  const log = useActivityLog(useSyncClient(), activity.activityId);

  const all = mergeLog(activity.comms, log?.entries ?? []);
  const shown = filterComms(all, { query, level });
  const pickLevel = (next: CommLevel | null) => {
    if (next === null) return; // one is always picked
    setLevel(next);
    storeLevel(next);
  };

  const requestDelete = async (entry: Comm) => {
    const confirmed = await confirm({ prompt: `Delete communication from ${entry.from} to ${entry.to} at ${format24HourTime(entry.at)}?`, destructive: true, label: 'Delete' });
    if (confirmed) change(() => entry.delete());
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <DashboardSearchBox onChange={setQuery} placeholder="Search messages, to, or from..." sx={{ flex: 1 }} />
        <ToggleButtonGroup exclusive size="small" value={level} onChange={(_, next: CommLevel | null) => pickLevel(next)} aria-label="Priorities shown" sx={{ height: 32 }}>
          {LEVELS.map((l) => (
            <Tooltip key={l.value} title={l.title}>
              <ToggleButton value={l.value} aria-label={l.title} sx={{ px: 1.25, minWidth: 36 }}>
                {l.label}
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
        <DashboardCommsPrintButton communications={shown} />
      </Stack>
      <DashboardAutoScrollContainer
        itemKeys={shown.map((c) => c.id)}
        paused={!!editingId}
        contentSx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.5, display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {shown.length === 0 ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              {all.length === 0 ? 'No communications logged yet.' : 'Nothing at these priorities.'}
            </Typography>
          </Box>
        ) : (
          shown.map((entry) =>
            isComm(entry) ? (
              <Paper
                key={entry.id}
                variant="outlined"
                sx={{
                  p: 1,
                  bgcolor: entry.favorite && editingId !== entry.id ? (theme) => alpha(theme.palette.info.main, 0.08) : undefined,
                  borderWidth: editingId === entry.id ? 2 : 1,
                  borderStyle: 'solid',
                  borderColor: editingId === entry.id ? 'primary.main' : 'divider',
                }}
              >
                {editingId === entry.id ? (
                  <DashboardCommsComposer entry={entry} onDone={() => setEditingId(null)} />
                ) : (
                  <DashboardCommsEntry
                    entry={entry}
                    onEdit={() => setEditingId(entry.id)}
                    onFavorite={() => change(() => entry.setFavorite(!entry.favorite))}
                    onPriority={(p) => change(() => entry.setPriority(p))}
                    onDelete={() => void requestDelete(entry)}
                  />
                )}
              </Paper>
            ) : (
              <DashboardLogLine key={entry.id} line={entry} onFavorite={() => change(() => entry.setFavorite(!entry.favorite))} />
            ),
          )
        )}
      </DashboardAutoScrollContainer>
      <DashboardCommsComposer />
    </Box>
  );
});

const actionSx = { opacity: 0, visibility: 'hidden', transition: 'opacity 180ms ease' };

const DashboardCommsEntry = observer(function DashboardCommsEntry({
  entry,
  onEdit,
  onFavorite,
  onPriority,
  onDelete,
}: {
  entry: Comm;
  onEdit: () => void;
  onFavorite: () => void;
  onPriority: (priority: CommPriority) => void;
  onDelete: () => void;
}) {
  return (
    <Box sx={{ '&:hover .comm-action': { opacity: 1, visibility: 'visible' } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">
          {entry.from} → {entry.to}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <PriorityChip priority={entry.priority} onChange={onPriority} />
          <IconButton className="comm-action" onClick={onFavorite} size="small" aria-label={entry.favorite ? 'unfavorite communication' : 'favorite communication'} sx={actionSx}>
            {entry.favorite ? <StarIcon sx={{ fontSize: 16, color: '#d89e00' }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
          </IconButton>
          <IconButton className="comm-action" onClick={onEdit} size="small" aria-label="edit communication" sx={actionSx}>
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton className="comm-action" onClick={onDelete} size="small" aria-label="delete communication" sx={actionSx}>
            <DeleteOutlineIcon sx={{ fontSize: 16, color: 'darkred' }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: 'text.secondary', px: 0.5 }}>
            {format24HourTime(entry.at)}
          </Typography>
        </Stack>
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {entry.message}
      </Typography>
      {coordinatesIn(entry.message).map((value) => (
        <DashboardCopyChip key={value} value={value} />
      ))}
    </Box>
  );
});

/** A line of the activity log: what changed, by whom. It can be starred, not edited. */
const DashboardLogLine = observer(function DashboardLogLine({ line, onFavorite }: { line: LogLine; onFavorite: () => void }) {
  return (
    <Box
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor: line.favorite ? (theme) => alpha(theme.palette.info.main, 0.08) : undefined,
        '&:hover .comm-action': { opacity: 1, visibility: 'visible' },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" sx={{ flex: 1, color: line.priority === 4 ? 'text.secondary' : 'text.primary' }}>
          {line.text}
        </Typography>
        <Chip label={`P${line.priority}`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
        <IconButton className="comm-action" onClick={onFavorite} size="small" aria-label={line.favorite ? 'unfavorite log line' : 'favorite log line'} sx={line.favorite ? undefined : actionSx}>
          {line.favorite ? <StarIcon sx={{ fontSize: 16, color: '#d89e00' }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
        </IconButton>
        <Typography variant="caption" sx={{ color: 'text.secondary', px: 0.5 }}>
          {format24HourTime(line.at)}
        </Typography>
      </Stack>
    </Box>
  );
});

/** The entry's priority, which opens a menu to change it. */
function PriorityChip({ priority, onChange }: { priority: CommPriority; onChange: (priority: CommPriority) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pick = (p: CommPriority) => {
    setAnchor(null);
    if (p !== priority) onChange(p);
  };
  return (
    <>
      <Chip
        label={`P${priority}`}
        size="small"
        color={priority === 1 ? 'warning' : 'default'}
        variant={priority === 3 ? 'outlined' : 'filled'}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={`priority ${priority}, change`}
        sx={{ height: 20, fontSize: 11, cursor: 'pointer' }}
      />
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {COMM_PRIORITIES.map((p) => (
          <MenuItem key={p} selected={p === priority} onClick={() => pick(p)}>
            {p} · {PRIORITY_NAMES[p]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// MUI's default option spreads a `key` prop into the <li>; passing it directly avoids React's warning.
function renderContactOption(props: HTMLAttributes<HTMLLIElement> & { key?: Key }, option: string) {
  const { key, ...optionProps } = props;
  return (
    <li key={key} {...optionProps}>
      {option}
    </li>
  );
}

/** Logs a new entry, or (with `entry`) edits one, time included. Enter saves; Shift+Enter is a new line. */
const DashboardCommsComposer = observer(function DashboardCommsComposer({ entry, onDone }: { entry?: Comm; onDone?: () => void }) {
  const activity = useCommandActivity();
  const change = useChange();
  const fromRef = useRef<HTMLInputElement | null>(null);
  const blank = { from: '', to: '', message: '', priority: DEFAULT_COMM_PRIORITY, at: Date.now() };
  const [values, setValues] = useState(entry ? { from: entry.from, to: entry.to, message: entry.message, priority: entry.priority, at: entry.at } : blank);
  const [messageMissing, setMessageMissing] = useState(false);
  const contacts = commsContacts(activity);

  useEffect(() => {
    if (!entry) fromRef.current?.focus();
  }, [entry]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!values.message.trim()) {
      setMessageMissing(true);
      return;
    }
    setMessageMissing(false);
    const saved = entry
      ? change(() => entry.edit({ from: values.from, to: values.to, message: values.message, priority: values.priority, at: values.at }))
      : change(() => activity.logComm({ from: values.from, to: values.to, message: values.message, priority: values.priority }));
    if (!saved) return;
    onDone?.();
    if (!entry) {
      setValues({ ...blank, at: Date.now() });
      fromRef.current?.focus();
    }
  };

  const contactField = (name: 'from' | 'to', label: string) => (
    <Autocomplete
      freeSolo
      fullWidth
      options={contacts}
      inputValue={values[name]}
      onInputChange={(_, value) => setValues((v) => ({ ...v, [name]: value }))}
      renderOption={renderContactOption}
      renderInput={(params) => <TextField {...params} label={label} size="small" inputRef={name === 'from' ? fromRef : undefined} />}
      sx={{ flex: entry ? 1 : undefined, minWidth: 0 }}
    />
  );

  return (
    <Box sx={{ borderColor: 'divider', p: 0.5, mt: entry ? 0 : 0.5, flexShrink: 0 }}>
      <form onSubmit={submit} aria-label={entry ? 'Edit communication' : 'Log communication'}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={2} sx={{ alignItems: { xs: 'stretch', xl: 'center' } }}>
            {contactField('from', 'From')}
            {contactField('to', 'To')}
            <TextField
              select
              label="Priority"
              size="small"
              value={values.priority}
              onChange={(e) => setValues((v) => ({ ...v, priority: Number(e.target.value) as CommPriority }))}
              sx={{ width: 120, flexShrink: 0 }}
            >
              {COMM_PRIORITIES.map((p) => (
                <MenuItem key={p} value={p}>
                  {p} · {PRIORITY_NAMES[p]}
                </MenuItem>
              ))}
            </TextField>
            {entry && (
              <DateTimePicker
                label="Time"
                value={new Date(values.at)}
                format="MM/dd/yyyy HH:mm"
                onChange={(value) => value && !Number.isNaN(value.getTime()) && setValues((v) => ({ ...v, at: value.getTime() }))}
                slotProps={{ textField: { size: 'small' } }}
                sx={{ flex: 1, minWidth: 0 }}
              />
            )}
          </Stack>
          <TextField
            label="Message"
            size="small"
            multiline
            minRows={2}
            value={values.message}
            onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
            error={messageMissing}
            helperText={messageMissing ? 'Message is required' : ''}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {entry && (
                <Button onClick={onDone} size="small">
                  Cancel
                </Button>
              )}
              <Button type="submit" size="small" variant="contained">
                Save
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </form>
    </Box>
  );
});

function DashboardCommsPrintButton({ communications }: { communications: LogItem[] }) {
  const activity = useCommandActivity();
  const printable = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printable, documentTitle: `${activity.record?.title || 'activity'}-comms-log` });
  return (
    <>
      <Tooltip title="Print communications log">
        <IconButton aria-label="Print communications log" onClick={() => handlePrint()} sx={{ width: 32, height: 32, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <PrintIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Box ref={printable} sx={{ display: 'none', '@media print': { display: 'block' } }}>
        <DashboardCommsPrintView communications={communications} />
      </Box>
    </>
  );
}

const dateTime = (value: number) => `${new Date(value).toLocaleDateString('en-US')} ${format24HourTime(value)}`;

const DashboardCommsPrintView = observer(function DashboardCommsPrintView({ communications }: { communications: LogItem[] }) {
  const record = useCommandActivity().record;
  const printedAt = Date.now();
  return (
    <Box sx={{ p: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell colSpan={5}>
              <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Stack>
                  <Typography variant="body2">{record?.title}</Typography>
                  <Typography variant="body2">State #: {record?.idNumber || '_____________'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Communications Log
                  </Typography>
                </Stack>
                <Stack sx={{ alignItems: 'flex-end' }}>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    Start Time: {record?.startTime ? dateTime(record.startTime) : '_____________'}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    End Time: {record?.endTime ? dateTime(record.endTime) : '_____________'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Printed: {dateTime(printedAt)}
                  </Typography>
                </Stack>
              </Stack>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, width: 80 }}>Time</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 40 }}>Pri</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 120 }}>From</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 120 }}>To</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {communications.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{format24HourTime(entry.at)}</TableCell>
              <TableCell>{entry.favorite ? '★' : entry.priority}</TableCell>
              <TableCell>{isComm(entry) ? entry.from : entry.by}</TableCell>
              <TableCell>{isComm(entry) ? entry.to : ''}</TableCell>
              <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{isComm(entry) ? entry.message : entry.text}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
});

const SCROLL_BOTTOM_THRESHOLD = 16;
const PROGRAMMATIC_SCROLL_TIMEOUT_MS = 500;

/**
 * Stays pinned to the bottom as new items arrive. Scrolling up stops that, and a button appears to
 * jump back down. `paused` holds off scrolling to new items (e.g. while one is being edited).
 */
function DashboardAutoScrollContainer({ itemKeys, paused = false, children, contentSx }: { itemKeys: string[]; paused?: boolean; children: ReactNode; contentSx?: SxProps<Theme> }) {
  const scroller = useRef<HTMLDivElement>(null);
  const previousKeys = useRef<string[] | null>(null);
  const pendingScroll = useRef(false);
  const initialized = useRef(false);
  const programmatic = useRef(false);
  const programmaticTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const beginProgrammaticScroll = () => {
    programmatic.current = true;
    if (programmaticTimeout.current) clearTimeout(programmaticTimeout.current);
    // In case the animation never reports a scroll event that lands exactly at the bottom.
    programmaticTimeout.current = setTimeout(() => (programmatic.current = false), PROGRAMMATIC_SCROLL_TIMEOUT_MS);
  };

  const keysText = itemKeys.join('\n');
  useEffect(() => {
    const keys = itemKeys;
    const previous = previousKeys.current;
    previousKeys.current = keys;
    const target = scroller.current;

    if (!initialized.current) {
      // Wait until the list has laid out before snapping to the bottom.
      if (target && keys.length > 0 && target.clientHeight > 0) {
        beginProgrammaticScroll();
        requestAnimationFrame(() => {
          target.scrollTop = target.scrollHeight;
          setAutoScroll(true);
        });
        initialized.current = true;
      }
      return;
    }
    if (!previous) return;
    if (keys.some((k) => !previous.includes(k))) pendingScroll.current = autoScroll;
    if (!autoScroll || paused || !pendingScroll.current) return;
    if (target) {
      beginProgrammaticScroll();
      target.scrollTo?.({ top: target.scrollHeight, behavior: 'smooth' });
      pendingScroll.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysText, autoScroll, paused]);

  const handleScroll = () => {
    const target = scroller.current;
    if (!target) return;
    const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight <= SCROLL_BOTTOM_THRESHOLD;
    if (programmatic.current) {
      // Ignore the in-flight auto-scroll's own events, so the button doesn't flicker.
      if (atBottom) {
        programmatic.current = false;
        if (programmaticTimeout.current) clearTimeout(programmaticTimeout.current);
        programmaticTimeout.current = null;
      }
      return;
    }
    setAutoScroll(atBottom);
  };

  const scrollToBottom = () => {
    const target = scroller.current;
    if (target) {
      beginProgrammaticScroll();
      target.scrollTo?.({ top: target.scrollHeight, behavior: 'smooth' });
    }
    setAutoScroll(true);
  };

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
      <Box ref={scroller} onScroll={handleScroll} sx={[{ height: '100%', overflow: 'auto', width: '100%' }, ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : [])]}>
        {children}
      </Box>
      {!autoScroll && (
        <Fab size="small" color="primary" onClick={scrollToBottom} aria-label="scroll to newest" sx={{ position: 'absolute', bottom: 8, right: 8 }}>
          <KeyboardArrowDownIcon />
        </Fab>
      )}
    </Box>
  );
}
