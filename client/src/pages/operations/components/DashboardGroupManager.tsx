import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import GroupsIcon from '@mui/icons-material/Groups';
import { Button, IconButton, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';

import { useActivityContext } from '@respond/components/activities/ActivityProvider';
import { useDialogs } from '@respond/components/DialogProvider';
import { Draggable, Droppable } from '@respond/components/DragAndDrop/DnDComponents';
import { useGroupCommands } from '@respond/lib/client/services/groups';
import { Participant, ParticipantStatus } from '@respond/shared/types/activity';
import { createNewGroup, EquipmentItem, Group, sortEquipmentAlphabetically } from '@respond/shared/types/operations';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';
import { DashboardDividedSection } from './DashboardDividedSection';
import { DashboardErrorIndicator } from './DashboardErrorIndicator';
import { DashboardGroupEditDialog } from './DashboardGroupEditDialog';
import { DashboardResourceReassignmentDialog } from './DashboardResourceReassignmentDialog';
import { DashboardTeamEquipment } from './DashboardTeamEquipment';
import { compareTeamNames } from './DashboardTeamManager';
import { DashboardTeamMember } from './DashboardTeamMember';

export function DashboardAddGroupButton() {
  const groupCommands = useGroupCommands();
  const activity = useActivityContext();
  const { open } = useDialogs();

  const handleAdd = async () => {
    const newGroup = await open(DashboardGroupEditDialog, { activity, group: createNewGroup('') });
    if (newGroup != null) groupCommands.createGroup(activity.id, newGroup);
  };

  return (
    <Button size="small" variant="contained" onClick={handleAdd}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <AddIcon fontSize="small" />
        <GroupsIcon fontSize="small" />
      </Box>
    </Button>
  );
}

export function DashboardGroupManager() {
  const activity = useActivityContext();

  // nullish coalese for backward compatibility on inital render
  const activityGroups = activity.groups ?? [];

  return (
    <Stack spacing={1}>
      {activityGroups.map((group) => (
        <GroupTile key={group.id} group={group}></GroupTile>
      ))}
    </Stack>
  );
}

function GroupTile({ group }: { group: Group }) {
  const groupCommands = useGroupCommands();
  const activity = useActivityContext();
  const { open, confirm } = useDialogs();

  const participants = (group.assignedParticipants ?? []).flatMap((id) => {
    const participant = activity.participants[id];
    return participant ? [participant] : [];
  });

  const sortedEquipment = [...group.assignedEquipment].sort(sortEquipmentAlphabetically);
  const sortedTeams = activity.teams.filter((f) => group.assignedTeams.includes(f.id)).sort((left, right) => compareTeamNames(left, right));

  const editGroup = async () => {
    const result = await open(DashboardGroupEditDialog, { activity, group });
    if (result != null) groupCommands.updateGroup(activity.id, result);
  };

  const deleteGroup = async () => {
    const hasResources = group.assignedParticipants.length + group.assignedEquipment.length > 0;
    if (!hasResources) {
      // Nothing to reassign, so a lightweight confirm is enough
      const confirmed = await confirm({ prompt: `Delete ${group.name}?`, destructive: true, label: 'Delete' });
      if (!confirmed) return;
      groupCommands.deleteGroup(activity.id, group.id);
      return;
    }

    const result = await open(DashboardResourceReassignmentDialog, { activity, origin: group, title: `Delete ${group.name}`, action: 'Delete' });
    if (!result) return;
    groupCommands.deleteGroup(activity.id, group.id, result.target);
  };

  const editAction = {
    id: 'edit',
    icon: <EditIcon sx={{ fontSize: 16 }} />,
    onClick: () => editGroup(),
  };

  const deleteAction = {
    id: 'delete',
    icon: <DeleteOutlineIcon sx={{ fontSize: 16, color: 'darkred' }} />,
    onClick: () => deleteGroup(),
  };

  const handleExpandedDrop = (item: Participant | EquipmentItem, type: string) => {
    if (type === 'participant') {
      // If the item was dragged and dropped back to the same group, cancel.
      if (group.assignedParticipants.includes(item.id)) return;
      groupCommands.assignParticipant(activity.id, item.id, { type: 'group', id: group.id });
    } else if (type === 'equipment') {
      addEquipment(item as EquipmentItem);
    }
  };

  const handleHeaderDrop = (item: Participant | EquipmentItem, type: string) => {
    if (type === 'participant') {
      // If this is already the leader, cancel.
      if (group.leaderId === item.id) return;
      groupCommands.updateGroup(activity.id, { ...group, leaderId: item.id });
    } else if (type === 'equipment') {
      addEquipment(item as EquipmentItem);
    }
  };

  const addEquipment = async (equipment: EquipmentItem) => {
    // If the item was dragged and dropped back to the same group, cancel.
    if (group.assignedEquipment.find((e) => e.uuid === equipment.uuid)) return;
    groupCommands.assignEquipment(activity.id, equipment, { type: 'group', id: group.id });
  };

  const handleLeaderClear = () => {
    groupCommands.updateGroup(activity.id, { ...group, leaderId: undefined });
  };

  const actions = [editAction, deleteAction];

  const hasContent = group.assignedParticipants.length > 0 || group.assignedEquipment.length > 0 || group.assignedTeams.length > 0;

  const hasPersonnelError = group.assignedParticipants.some((id) => activity.participants[id].timeline[0].status !== ParticipantStatus.Assigned);

  const leader = group.leaderId ? activity.participants[group.leaderId] : undefined;
  const leaderName = leader ? `${leader.firstname} ${leader.lastname}` : 'Unassigned';

  const subtitle = (
    <Stack direction="row" sx={{ '&:hover .action': { opacity: 1, visibility: 'visible' }, alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography component="div" sx={{ color: 'text.secondary' }}>
        {leaderName}
      </Typography>
      {leader && (
        <IconButton className="action" onClick={handleLeaderClear} size="small" aria-label="delete communication" sx={{ opacity: 0, visibility: 'hidden', transition: 'opacity 180ms ease' }}>
          <ClearIcon sx={{ fontSize: 14, color: 'darkred' }} />
        </IconButton>
      )}
    </Stack>
  );

  return (
    <Droppable accepts={['participant', 'equipment']} onDrop={handleHeaderDrop}>
      <DashboardBoxWithTitle
        title={group.name}
        subtitle={subtitle}
        actions={actions}
        collapse
        collapsible
        icon={<GroupsIcon fontSize="small" />}
        adornment={hasPersonnelError ? <DashboardErrorIndicator message="One or more personnel are not assigned to the activity." size={16} /> : undefined}
      >
        <Droppable accepts={['participant', 'equipment']} onDrop={handleExpandedDrop}>
          <Stack spacing={1}>
            {!!group.assignedParticipants.length && (
              <DashboardDividedSection title="Personnel">
                <Stack spacing={0.5}>
                  {participants.map((participant) => {
                    return (
                      <Draggable key={participant.id} type="participant" item={participant}>
                        <DashboardTeamMember participant={participant} />
                      </Draggable>
                    );
                  })}
                </Stack>
              </DashboardDividedSection>
            )}
            {!!sortedEquipment.length && (
              <DashboardDividedSection title="Equipment">
                <Stack spacing={0.5}>
                  {sortedEquipment.map((item) => {
                    return (
                      <Draggable key={item.uuid} type="equipment" item={item}>
                        <DashboardTeamEquipment item={item} />
                      </Draggable>
                    );
                  })}
                </Stack>
              </DashboardDividedSection>
            )}
            {!!sortedTeams.length && (
              <DashboardDividedSection title="Teams">
                <Stack spacing={0.5}>
                  {sortedTeams.map((team) => {
                    return <>{team.name}</>;
                  })}
                </Stack>
              </DashboardDividedSection>
            )}
          </Stack>
          {!hasContent && (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 1 }}>
              No resources assigned.
            </Typography>
          )}
        </Droppable>
      </DashboardBoxWithTitle>
    </Droppable>
  );
}
