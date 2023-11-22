import { useState } from 'react';

import { useAppSelector } from '@respond/lib/client/store';
import { earlySigninWindow, isFuture } from '@respond/lib/client/store/activities';
import { Activity, isActive, ParticipantStatus } from '@respond/types/activity';
import { MyOrganization } from '@respond/types/organization';
import { UserInfo } from '@respond/types/userInfo';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '../Material';
import { SplitButton } from '../SplitButton';

import { UpdateStatusForm, useFormLogic } from './UpdateStatusForm';

const statusTransitions = {
  standBy: { id: 0, newStatus: ParticipantStatus.Standby, text: 'Stand By' },
  standDown: {
    id: 1,
    newStatus: ParticipantStatus.SignedOut,
    text: 'Stand Down',
  },
  inTown: { id: 2, newStatus: ParticipantStatus.Remote, text: 'In Town' },
  signIn: { id: 3, newStatus: ParticipantStatus.SignedIn, text: 'Sign In' },
  turnAround: {
    id: 4,
    newStatus: ParticipantStatus.Demobilized,
    text: 'Turn Around',
  },
  arriveBase: {
    id: 5,
    newStatus: ParticipantStatus.Available,
    text: 'Arrive Base',
  },
  departBase: {
    id: 6,
    newStatus: ParticipantStatus.Demobilized,
    text: 'Depart Base',
  },
  signOut: { id: 7, newStatus: ParticipantStatus.SignedOut, text: 'Sign Out' },
  resetStatus: {
    id: 8,
    newStatus: ParticipantStatus.NotResponding,
    text: 'Reset Status',
  }, // clear status in edge cases that shouldn't generally be possible.
  assigned: { id: 9, newStatus: ParticipantStatus.Assigned, text: 'Assigned' },
  available: {
    id: 10,
    newStatus: ParticipantStatus.Available,
    text: 'Available',
  },
};

const statusOptions: Record<ParticipantStatus, { id: number; newStatus: ParticipantStatus; text: string }[]> = {
  [ParticipantStatus.NotResponding]: [statusTransitions.signIn, statusTransitions.standBy, statusTransitions.inTown],
  [ParticipantStatus.Standby]: [statusTransitions.signIn, statusTransitions.standDown],
  [ParticipantStatus.Remote]: [statusTransitions.signOut],
  [ParticipantStatus.SignedIn]: [statusTransitions.arriveBase, statusTransitions.turnAround, statusTransitions.signOut],
  [ParticipantStatus.Available]: [statusTransitions.departBase, statusTransitions.assigned],
  [ParticipantStatus.Assigned]: [statusTransitions.available],
  [ParticipantStatus.Demobilized]: [statusTransitions.signOut, statusTransitions.signIn, statusTransitions.arriveBase],
  [ParticipantStatus.SignedOut]: [statusTransitions.signIn, statusTransitions.standBy, statusTransitions.inTown],
};

const standbyOnlyStatusOptions: Record<ParticipantStatus, { id: number; newStatus: ParticipantStatus; text: string }[]> = {
  [ParticipantStatus.NotResponding]: [statusTransitions.standBy],
  [ParticipantStatus.Standby]: [statusTransitions.standDown],
  [ParticipantStatus.Remote]: [statusTransitions.resetStatus],
  [ParticipantStatus.SignedIn]: [statusTransitions.resetStatus],
  [ParticipantStatus.Available]: [statusTransitions.resetStatus],
  [ParticipantStatus.Assigned]: [statusTransitions.resetStatus],
  [ParticipantStatus.Demobilized]: [statusTransitions.resetStatus],
  [ParticipantStatus.SignedOut]: [statusTransitions.standBy],
};

function getStatusOptions(current: ParticipantStatus | undefined, startTime: number, standbyOnly: boolean) {
  const status = current ?? ParticipantStatus.NotResponding;

  // Reasons an activity is treated as standby only:
  // 1. The activity's sign-in window is in the future.
  // 2. The activity is marked as standby only, and the current responder is not active.
  //    If the responder is already active, let them update their status as normal.
  if (isFuture(startTime - earlySigninWindow) || (standbyOnly && !isActive(status))) {
    return standbyOnlyStatusOptions[status];
  }

  return statusOptions[status];
}

export const StatusUpdater = ({ activity, current }: { activity: Activity; current?: ParticipantStatus }) => {
  const user = useAppSelector((state) => state.auth.userInfo);
  const thisOrg = useAppSelector((state) => state.organization.mine);

  return user && thisOrg ? <StatusUpdaterProtected activity={activity} current={current} user={user} thisOrg={thisOrg} /> : null;
};

const StatusUpdaterProtected = ({ activity, current, user, thisOrg }: { activity: Activity; user: UserInfo; thisOrg: MyOrganization; current?: ParticipantStatus }) => {
  const [confirming, setConfirming] = useState<boolean>(false);
  const [confirmTitle, setConfirmTitle] = useState<string>('');
  const [confirmStatus, setConfirmStatus] = useState<ParticipantStatus>(ParticipantStatus.SignedIn);
  const [confirmLabel, setConfirmLabel] = useState<string>('');

  current = current ?? activity.participants[user.participantId]?.timeline[0]?.status;

  const formLogic = useFormLogic(activity, user, thisOrg, activity.participants[user.participantId], current, confirmStatus, () => setConfirming(false));

  function confirmPrompt(title: string, optionId: number) {
    const option = Object.values(statusTransitions).find((f) => f.id === optionId);
    setConfirmTitle(title);
    setConfirmStatus(option?.newStatus ?? 0);
    setConfirmLabel(option?.text ?? '');
    setConfirming(true);
  }

  const actions = getStatusOptions(current, activity.startTime, activity.standbyOnly);
  return (
    <>
      <SplitButton
        options={actions}
        selected={actions[0].id}
        onClick={(optionId) => {
          confirmPrompt('Update Status', optionId);
        }}
      />
      <Dialog open={confirming} onClose={() => setConfirming(false)} aria-labelledby="status-update-dialog-title" aria-describedby="status-update-dialog-description">
        <form onSubmit={formLogic.doSubmit}>
          <DialogTitle id="status-update-dialog-title">{confirmTitle}</DialogTitle>
          <DialogContent>
            <>
              {!activity.organizations[thisOrg.id] && (
                <Alert sx={{ mb: 1 }} severity="warning">
                  You are the first responder for {thisOrg.rosterName}. Make sure you are authorized to commit {thisOrg.rosterName} to this {activity.isMission ? 'mission' : 'event'}.
                </Alert>
              )}
              <UpdateStatusForm form={formLogic} />
            </>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button type="submit" autoFocus>
              {confirmLabel}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};
