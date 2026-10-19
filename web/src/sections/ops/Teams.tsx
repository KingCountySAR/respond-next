import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Button, Chip, DialogActions, DialogContent, DialogTitle, Divider, IconButton, MenuItem, Paper, Select, Stack, TextField, Typography, type SelectChangeEvent } from '@mui/material';
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { GARS, type Gar, type TeamStatus } from '@sync/domain';
import type { CommandActivity, CommandEquipment, CommandParticipant, CommandTeam } from '@sync/model';
import { observer, useCommandActivity } from '@sync/model/react';
import { useDialogs, type MuiDialogProps } from '../../shell/dialogs';
import { AppDialog } from '../../shell/dialogs/AppDialog';
import { useChange } from '../../ui/useChange';
import { Draggable, Droppable } from './dnd';
import { dropEquipment, type EquipmentDrag } from './drops';
import { GAR_COLORS, TEAM_STATUS_ORDER, TEAM_STATUS_TEXT, byName, nextTeamNumber, sortTeams, teamRoster, uniqueNameError } from './opsRules';
import { DashboardErrorIndicator, StatusContainer } from './parts';
import { DashboardTeamEquipment, DashboardTeamMember, hasUnassignedPersonnel } from './People';
import { chooseReassignment } from './ReassignDialog';

type ExpandCommand = { expanded: boolean; nonce: number };

export const DashboardTeamManager = observer(function DashboardTeamManager() {
  const activity = useCommandActivity();
  const change = useChange();
  const [expandCommand, setExpandCommand] = useState<ExpandCommand | undefined>(undefined);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Record<string, boolean>>({});
  const teams = activity.teams;
  const anyExpanded = teams.some((team) => expandedTeamIds[team.id]);

  const addTeam = () => change(() => activity.createTeam(`Team ${nextTeamNumber(teams.map((t) => t.name))}`));

  // The nonce reruns every card's effect even when `expanded` repeats (a card collapsed by hand
  // after "Expand all" must still follow the next "Expand all").
  const toggleAll = () => setExpandCommand({ expanded: !anyExpanded, nonce: Date.now() });

  const handleExpandedChange = (teamId: string, expanded: boolean) => setExpandedTeamIds((current) => (current[teamId] === expanded ? current : { ...current, [teamId]: expanded }));

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Button size="small" variant="outlined" onClick={toggleAll}>
          {anyExpanded ? 'Collapse all' : 'Expand all'}
        </Button>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={addTeam}>
          Add
        </Button>
      </Stack>
      <Box sx={{ flex: 1, width: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="column" spacing={1} sx={{ minHeight: 0, flex: 1 }}>
          {teams.length ? (
            [...teams].sort(sortTeams).map((team) => <DashboardTeamCard key={team.id} team={team} expandCommand={expandCommand} onExpandedChange={(expanded) => handleExpandedChange(team.id, expanded)} />)
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                There are no active teams.
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>
    </>
  );
});

const DashboardTeamCard = observer(function DashboardTeamCard({ team, expandCommand, onExpandedChange }: { team: CommandTeam; expandCommand?: ExpandCommand; onExpandedChange?: (expanded: boolean) => void }) {
  const activity = useCommandActivity();
  const change = useChange();
  const { open } = useDialogs();
  const [isExpanded, setIsExpanded] = useState(false);
  const isDisbanded = team.status === 'disbanded';

  useEffect(() => {
    if (expandCommand !== undefined) setIsExpanded(expandCommand.expanded);
  }, [expandCommand]);

  useEffect(() => {
    onExpandedChange?.(isExpanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const { leader, others } = teamRoster(team);
  const members = team.members;
  const equipment = [...team.equipment].sort(byName);

  /**
   * A person dropped on the open card's header leads the team, as does the first person on a team
   * with no leader (the legacy app's leader was the team's first member).
   */
  const dropOn = (asLeader: boolean) => (item: CommandParticipant | EquipmentDrag, type: string) => {
    if (type === 'participant') {
      const p = item as CommandParticipant;
      const lead = asLeader || !team.leader;
      if (lead ? team.leader?.id === p.id : members.some((m) => m.id === p.id)) return;
      change(() => p.assign(team.asTarget, { asLeader: lead }));
    } else if (type === 'equipment') {
      change(() => dropEquipment(activity, item as EquipmentDrag, team.asTarget));
    }
  };

  const editTeam = () => void open(DashboardTeamEditDialog, { team, activity });

  const handleExpandClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsExpanded((current) => !current);
  };

  const accepts = isDisbanded ? [] : ['participant', 'equipment'];

  return (
    <StatusContainer color={isDisbanded ? 'grey' : team.gar && GAR_COLORS[team.gar]} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', borderRadius: 2, p: 1, pl: 0.5, bgcolor: 'background.paper', height: '100%' }}>
        <Droppable accepts={accepts} onDrop={dropOn(isExpanded)}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <IconButton onClick={handleExpandClick} size="small" aria-label={isExpanded ? `Collapse ${team.name}` : `Expand ${team.name}`} sx={{ width: 32, height: 32 }}>
                {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </IconButton>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, cursor: 'pointer', color: isDisbanded ? 'text.disabled' : undefined }} onClick={editTeam}>
                  {team.name}
                </Typography>
                <DashboardErrorIndicator message={hasUnassignedPersonnel(members) ? 'One or more team members are not assigned to the activity.' : undefined} size={16} />
                {leader && (
                  <Draggable type="participant" item={leader}>
                    <DashboardTeamMember participant={leader} />
                  </Draggable>
                )}
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TeamStatusSelect team={team} />
              <Chip label={`${members.length} members`} size="small" variant="outlined" />
            </Stack>
          </Stack>
        </Droppable>
        {isExpanded && (
          <Droppable accepts={accepts} onDrop={dropOn(false)}>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" spacing={1} sx={{ flex: 1, overflow: 'auto' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', pl: 1 }}>
                  Team Members
                </Typography>
                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                  {others.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', pl: 1 }}>
                      None
                    </Typography>
                  ) : (
                    others.map((p) => (
                      <Draggable key={p.id} type="participant" item={p}>
                        <DashboardTeamMember participant={p} />
                      </Draggable>
                    ))
                  )}
                </Stack>
              </Box>
              <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Details
                </Typography>
                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                  <Typography variant="body2">GAR: {team.gar}</Typography>
                  {team.assignment && <Typography variant="body2">Assignment: {team.assignment}</Typography>}
                </Stack>
              </Box>
              <Box sx={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', pr: 1 }}>
                  Equipment
                </Typography>
                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                  {equipment.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', pr: 1 }}>
                      None
                    </Typography>
                  ) : (
                    equipment.map((item) => (
                      <Draggable key={item.id} type="equipment" item={{ item } satisfies EquipmentDrag}>
                        <DashboardTeamEquipment item={item} />
                      </Draggable>
                    ))
                  )}
                </Stack>
              </Box>
            </Stack>
            {team.notes?.trim() && (
              <Box sx={{ width: '100%', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Notes
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {team.notes}
                </Typography>
              </Box>
            )}
          </Droppable>
        )}
      </Box>
    </StatusContainer>
  );
});

// Chip colors for the statuses.
const STATUS_COLORS: Record<TeamStatus, 'default' | 'info' | 'warning' | 'success' | 'secondary'> = {
  inBase: 'default',
  inTransit: 'info',
  onAssignment: 'warning',
  onScene: 'success',
  returningToBase: 'secondary',
  disbanded: 'default',
};

const holdsResources = (team: CommandTeam) => team.members.length + team.equipment.length > 0;

const TeamStatusSelect = observer(function TeamStatusSelect({ team }: { team: CommandTeam }) {
  const activity = useCommandActivity();
  const dialogs = useDialogs();
  const change = useChange();

  const handleChange = async (event: SelectChangeEvent<string>) => {
    const status = event.target.value as TeamStatus;
    if (status !== 'disbanded') {
      change(() => team.setStatus(status));
      return;
    }
    if (team.status === 'disbanded') return;
    // A team in base, or holding nothing, just ends; otherwise choose where its resources go.
    const target = await chooseReassignment(dialogs, activity, team.asTarget, { holdsResources: team.status !== 'inBase' && holdsResources(team), title: `Disband ${team.name}`, action: 'Disband' });
    if (target !== undefined) change(() => team.disband(target));
  };

  return (
    <Select
      value={team.status}
      onChange={handleChange}
      variant="outlined"
      size="small"
      inputProps={{ 'aria-label': `${team.name} status` }}
      sx={{
        borderRadius: '16px', // pill
        height: 28,
        fontSize: '0.75rem',
        fontWeight: 600,
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '& .MuiSelect-select': { paddingLeft: '12px', paddingRight: '28px !important', paddingTop: '2px', paddingBottom: '2px', display: 'flex', alignItems: 'center' },
        '& .MuiSelect-icon': { right: '6px', color: 'inherit', fontSize: '1.1rem' },
      }}
    >
      {TEAM_STATUS_ORDER.map((status) => (
        <MenuItem key={status} value={status}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Chip label={TEAM_STATUS_TEXT[status]} size="small" color={STATUS_COLORS[status]} sx={{ height: 20, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }} />
          </Box>
        </MenuItem>
      ))}
    </Select>
  );
});

const GAR_TEXT: Record<Gar, string> = { green: 'Green', amber: 'Amber', red: 'Red' };

/** The legacy DashboardTeamEditDialog: name, GAR, assignment and notes, and Delete. */
function DashboardTeamEditDialog({ team, activity, onClose }: MuiDialogProps<null> & { team: CommandTeam; activity: CommandActivity }) {
  const dialogs = useDialogs();
  const change = useChange();
  const [values, setValues] = useState({ name: team.name, gar: team.gar ?? 'green', assignment: team.assignment ?? '', notes: team.notes ?? '' });
  const [nameError, setNameError] = useState<string>();

  const save = (e: FormEvent) => {
    e.preventDefault();
    const error = uniqueNameError(
      values.name,
      activity.teams.filter((t) => t.id !== team.id).map((t) => t.name),
      'Team',
    );
    if (error) {
      setNameError(error);
      return;
    }
    if (change(() => team.update({ name: values.name.trim(), gar: values.gar, assignment: values.assignment.trim(), notes: values.notes.trim() }))) onClose(null);
  };

  // Close this dialog first so the next one isn't stacked behind it. Closing pops browser history,
  // which the dialog provider only hears asynchronously; opening the next dialog at once would push
  // its history entry first and the pending pop would close that one instead.
  const deleteTeam = async () => {
    onClose(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const target = await chooseReassignment(dialogs, activity, team.asTarget, {
      holdsResources: team.status !== 'inBase' && holdsResources(team),
      title: `Delete ${team.name}`,
      action: 'Delete',
      confirmPrompt: `Delete ${team.name}?`,
    });
    if (target !== undefined) change(() => team.delete(target));
  };

  const field = (name: 'name' | 'assignment' | 'notes') => ({ value: values[name], onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })) });

  return (
    <AppDialog fullWidth open onClose={onClose}>
      <DialogTitle>Edit Team</DialogTitle>
      <form onSubmit={save}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField autoFocus label="Team name" fullWidth {...field('name')} error={!!nameError} helperText={nameError ?? 'Choose a unique name for this team.'} />
            <TextField label="GAR" select fullWidth value={values.gar} onChange={(e) => setValues((v) => ({ ...v, gar: e.target.value as Gar }))}>
              {GARS.map((gar) => (
                <MenuItem key={gar} value={gar}>
                  {GAR_TEXT[gar]}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Assignment" fullWidth {...field('assignment')} />
            <TextField label="Notes" fullWidth multiline minRows={3} {...field('notes')} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button color="error" onClick={deleteTeam}>
            Delete
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => onClose(null)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save
            </Button>
          </Stack>
        </DialogActions>
      </form>
    </AppDialog>
  );
}

/** The phone view's teams: tap to open, nothing to change. */
export const DashboardReadOnlyTeams = observer(function DashboardReadOnlyTeams() {
  const teams = useCommandActivity().teams;
  return (
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, flex: 1, minWidth: 180 }}>
      <Stack spacing={1}>
        {teams.length ? (
          [...teams].sort(sortTeams).map((team) => <DashboardReadOnlyTeamCard key={team.id} team={team} />)
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              There are no active teams.
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
});

const DashboardReadOnlyTeamCard = observer(function DashboardReadOnlyTeamCard({ team }: { team: CommandTeam }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { leader, others } = teamRoster(team);
  const equipment: CommandEquipment[] = [...team.equipment].sort(byName);
  return (
    <Box>
      <StatusContainer color={team.status === 'disbanded' ? 'grey' : team.gar && GAR_COLORS[team.gar]} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', borderRadius: 2, p: 1, pl: 0.5, bgcolor: 'background.paper', height: '100%' }} onClick={() => setIsExpanded((prev) => !prev)}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <IconButton size="small" aria-label={isExpanded ? `Collapse ${team.name}` : `Expand ${team.name}`} sx={{ width: 32, height: 32 }}>
                {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </IconButton>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, cursor: 'pointer' }}>
                  {team.name}
                </Typography>
                {!!leader && (
                  <Typography variant="body2" color="text.secondary">
                    {leader.name}
                  </Typography>
                )}
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontSize: '14px' }}>
                {TEAM_STATUS_TEXT[team.status]}
              </Typography>
            </Stack>
          </Stack>
          {isExpanded && (
            <>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={1} sx={{ flex: 1, overflow: 'auto' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                    Team Members
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5, p: 1 }}>
                    {others.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                        None
                      </Typography>
                    ) : (
                      others.map((p) => (
                        <Typography key={p.id} variant="body2" color="text.secondary">
                          {p.name}
                        </Typography>
                      ))
                    )}
                  </Stack>
                </Box>
                <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Details
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5, p: 1 }}>
                    <Typography variant="body2">GAR: {team.gar}</Typography>
                    {team.assignment && <Typography variant="body2">Assignment: {team.assignment}</Typography>}
                  </Stack>
                </Box>
                <Box sx={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ pr: 1 }}>
                    Equipment
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5, p: 1 }}>
                    {equipment.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ pr: 1 }}>
                        None
                      </Typography>
                    ) : (
                      equipment.map((item) => (
                        <Typography key={item.id} variant="body2" color="text.secondary">
                          {item.name}
                        </Typography>
                      ))
                    )}
                  </Stack>
                </Box>
              </Stack>
              {team.notes?.trim() && (
                <Box sx={{ width: '100%', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {team.notes}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>
      </StatusContainer>
    </Box>
  );
});
