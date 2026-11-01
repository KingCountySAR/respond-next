/** The dashboard's building blocks: panels, titled boxes, tiles, chips and the search box. */
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SortIcon from '@mui/icons-material/Sort';
import { Box, Chip, IconButton, InputAdornment, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Stack, TextField, Tooltip, Typography, type SxProps, type Theme } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { DragHandle } from './dnd';

const sxList = (sx?: SxProps<Theme>) => (Array.isArray(sx) ? sx : sx ? [sx] : []);

/** The theme's card hover tint, laid over whatever the background is: darker in light mode, lighter in dark. */
const hoverTint = (theme: Theme) => `linear-gradient(${theme.palette.card.hover}, ${theme.palette.card.hover})`;

/** A column of the dashboard: a header with a title and actions over a body. */
export function DashboardPanel({ title, icon, children, grow = false, actions }: { title: string; icon?: ReactNode; children: ReactNode; grow?: boolean; actions?: ReactNode }) {
  const theme = useTheme();
  return (
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: grow ? 1 : 'initial',
        minHeight: 0,
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        transition: theme.transitions.create(['all'], { duration: theme.transitions.duration.shorter }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, bgcolor: 'action.hover', borderBottom: `1px solid ${theme.palette.divider}`, minHeight: 48 }}>
        <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
          {icon && <Box sx={{ display: 'flex', color: 'action.active' }}>{icon}</Box>}
          <Typography variant="subtitle1" noWrap sx={{ userSelect: 'none', fontWeight: 600 }}>
            {title}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          {actions}
        </Stack>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', p: 1.5 }}>{children}</Box>
    </Paper>
  );
}

export interface BoxAction {
  id: string;
  icon: ReactNode;
  /** The button's accessible name. */
  label: string;
  onClick: () => void;
}

/** A bordered box with a title row; actions show on hover, and it can collapse. */
export function DashboardBoxWithTitle({
  title,
  subtitle,
  actions = [],
  collapse = false,
  collapsible = false,
  children,
  icon,
  adornment,
  sx,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: BoxAction[];
  collapse?: boolean;
  collapsible?: boolean;
  children?: ReactNode;
  icon?: ReactNode;
  adornment?: ReactNode;
  sx?: SxProps<Theme>;
}) {
  const [collapsed, setCollapsed] = useState(collapse);
  const [hovered, setHovered] = useState(false);
  return (
    <Stack
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={[{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: 1 }, ...sxList(sx)]}
      spacing={0.5}
    >
      <Stack direction="row" onClick={() => collapsible && setCollapsed((c) => !c)} sx={{ alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {icon}
          <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center' }}>{title}</Typography>
          {adornment}
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Stack direction="row" sx={{ visibility: hovered ? 'visible' : 'hidden' }}>
            {actions.map((action) => (
              <IconButton
                key={action.id}
                size="small"
                aria-label={action.label}
                sx={{ width: 24, height: 24 }}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
              >
                {action.icon}
              </IconButton>
            ))}
          </Stack>
          {collapsible && (
            <IconButton size="small" aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`} sx={{ width: 24, height: 24 }}>
              {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
            </IconButton>
          )}
        </Stack>
      </Stack>
      {!!subtitle &&
        (isValidElement(subtitle) ? (
          subtitle
        ) : (
          <Typography component="div" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        ))}
      {!collapsed && children}
    </Stack>
  );
}

/** A captioned section with a rule above it. */
export function DashboardDividedSection({ title, children, sx }: { title: string; children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Stack spacing={0.5} sx={[{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }, ...sxList(sx)]}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

export function DashboardMetricTile({ label, value, variant }: { label: string; value: string; variant?: 'desktop' | 'mobile' }) {
  return (
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, flex: 1, minWidth: variant === 'mobile' ? undefined : 180 }}>
      <Stack spacing={0} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="div" sx={{ fontWeight: 700, fontSize: variant === 'mobile' ? '1rem' : '2rem' }}>
          {value}
        </Typography>
        <Typography component="div" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
      </Stack>
    </Paper>
  );
}

/** A red error icon with the message on hover; nothing without a message. */
export function DashboardErrorIndicator({ message, size = 20 }: { message?: string; size?: number | string }) {
  if (!message) return null;
  return (
    <Tooltip title={message} arrow placement="top">
      <Box aria-label={message} sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'error.main', fontSize: size, cursor: 'help', lineHeight: 1 }}>
        <ErrorIcon fontSize="inherit" />
      </Box>
    </Tooltip>
  );
}

export function DashboardSearchBox({ placeholder, onChange, sx }: { placeholder?: string; onChange: (value: string) => void; sx?: SxProps<Theme> }) {
  const [query, setQuery] = useState('');
  const change = (value: string) => {
    setQuery(value);
    onChange(value);
  };
  return (
    <Box sx={sx}>
      <TextField
        size="small"
        placeholder={placeholder || 'Search...'}
        fullWidth
        value={query}
        onChange={(e) => change(e.target.value)}
        sx={{ '& .MuiInputBase-root': { height: 32 } }}
        slotProps={{
          input: {
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => change('')} aria-label="clear search">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
    </Box>
  );
}

/** How a card stands out: as usual, faded (not available, or not draggable), or needing attention. Colors are the theme's `card`. */
export type CardTone = 'normal' | 'faded' | 'attention';

/** A card that looks draggable, unless `disabled` (not draggable: faded, without the grab look). */
export function DashboardDraggableContainer({
  children,
  sx,
  showHandle = true,
  variant = 'standard',
  disabled = false,
  tone = disabled ? 'faded' : 'normal',
}: {
  children: ReactNode;
  sx?: SxProps<Theme>;
  showHandle?: boolean;
  variant?: 'standard' | 'compact';
  disabled?: boolean;
  tone?: CardTone;
}) {
  const compact = variant === 'compact';
  const base: SxProps<Theme> = { width: '100%', minWidth: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: compact ? 0.5 : 1, bgcolor: `card.${tone}`, opacity: tone === 'faded' ? 0.9 : 1 };
  const draggable: SxProps<Theme> = {
    ...base,
    cursor: 'grab',
    boxShadow: (theme) => theme.palette.card.shadow,
    transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease',
    ':hover': { backgroundImage: hoverTint, borderColor: 'primary.light', boxShadow: (theme: Theme) => theme.palette.card.raisedShadow, '& .drag-handle': { opacity: 0.9 } },
    // Not when the press is on something clickable in the card (a name link, a status chip).
    ':active:not(:has(button:active, [role="button"]:active))': { cursor: 'grabbing', transform: 'scale(0.97)' },
  };
  return (
    <Stack direction="row" spacing={compact ? 0.5 : 1} sx={[{ alignItems: 'center', justifyContent: 'flex-start' }, disabled ? base : draggable, ...sxList(sx)]}>
      {showHandle && <DragHandle />}
      {children}
    </Stack>
  );
}

/** A colored bar down the left of its content. */
export function StatusContainer({ color, children, sx }: { color: string | undefined; children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Stack direction="row" sx={sx}>
      <Paper elevation={0} sx={{ width: 8, flexShrink: 0, bgcolor: color ?? 'transparent', borderBottomRightRadius: 0, borderTopRightRadius: 0 }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>{children}</Box>
    </Stack>
  );
}

/** Copies its value when clicked, and says so for a few seconds. */
export function DashboardCopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy text to clipboard:', err);
    }
  };

  return (
    <Chip
      size="small"
      variant="outlined"
      label={copied ? `${value} copied` : value}
      color={copied ? 'success' : 'default'}
      icon={copied ? <CheckIcon /> : <ContentCopyIcon />}
      onClick={copy}
      clickable
      sx={{
        px: 1,
        mt: 1,
        boxShadow: (theme) => theme.palette.card.shadow,
        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease',
        ':hover': { backgroundImage: hoverTint, borderColor: 'primary.light', boxShadow: (theme: Theme) => theme.palette.card.raisedShadow },
      }}
    />
  );
}

/** A square outlined icon button, highlighted when `on`. */
export function DashboardToggleButton({ on, title, label, onClick, children }: { on: boolean; title: string; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip title={title}>
      <IconButton color={on ? 'primary' : 'default'} aria-label={label} onClick={onClick} sx={{ width: 32, height: 32, borderRadius: 1, border: '1px solid', borderColor: on ? 'primary.main' : 'divider' }}>
        {children}
      </IconButton>
    </Tooltip>
  );
}

/** A square outlined icon button opening a menu of sorts; the current one is checked. */
export function DashboardSortMenu<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = options.find((o) => o.value === value)?.label;
  return (
    <>
      <Tooltip title={`Sort by: ${current}`}>
        <IconButton aria-label="Sort" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)} sx={{ width: 32, height: 32, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <SortIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {options.map((o) => (
          <MenuItem
            key={o.value}
            selected={o.value === value}
            onClick={() => {
              onChange(o.value);
              setAnchor(null);
            }}
          >
            <ListItemIcon>{o.value === value && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{o.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
