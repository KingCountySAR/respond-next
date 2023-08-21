import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle  } from '../Material';
import { useAppSelector } from '@respond/lib/client/store';
import { Activity, ResponderStatus } from '@respond/types/activity';
import { MyOrganization } from '@respond/types/organization';
import { UserInfo } from '@respond/types/userInfo';
import { SplitButton } from '../SplitButton';
import { useFormLogic, UpdateStatusForm } from './UpdateStatusForm';
import { isFuture, earlySigninWindow } from '@respond/lib/client/store/activities';

const statusTransitions = {
  standBy: { id: 0, newStatus: ResponderStatus.Standby, text: 'Stand By' },
  standDown: { id: 1, newStatus: ResponderStatus.SignedOut, text: 'Stand Down' },
  inTown: { id: 2, newStatus: ResponderStatus.Remote, text: 'In Town' },
  signIn: { id: 3, newStatus: ResponderStatus.SignedIn, text: 'Sign In' },
  turnAround: { id: 4, newStatus: ResponderStatus.Demobilized, text: 'Turn Around' },
  arriveBase: { id: 5, newStatus: ResponderStatus.Available, text: 'Arrive Base' },
  departBase: { id: 6, newStatus: ResponderStatus.Demobilized, text: 'Depart Base' },
  signOut: { id: 7, newStatus: ResponderStatus.SignedOut, text: 'Sign Out' },
  resetStatus: { id: 8, newStatus: ResponderStatus.NotResponding, text: 'Reset Status' }, // clear status in edge cases that shouldn't generally be possible.
  assigned: { id: 9, newStatus: ResponderStatus.Assigned, text: 'Assigned' },
  available: { id: 10, newStatus: ResponderStatus.Available, text: 'Available' }
}

const statusOptions: Record<ResponderStatus, { id: number, newStatus: ResponderStatus, text: string }[]> = {
  [ResponderStatus.NotResponding]: [statusTransitions.signIn, statusTransitions.standBy, statusTransitions.inTown],
  [ResponderStatus.Standby]: [statusTransitions.signIn, statusTransitions.standDown],
  [ResponderStatus.Remote]: [statusTransitions.signOut],
  [ResponderStatus.SignedIn]: [statusTransitions.arriveBase, statusTransitions.turnAround, statusTransitions.signOut],
  [ResponderStatus.Available]: [statusTransitions.departBase, statusTransitions.assigned],
  [ResponderStatus.Assigned]: [statusTransitions.available],
  [ResponderStatus.Demobilized]: [statusTransitions.signOut, statusTransitions.signIn, statusTransitions.arriveBase],
  [ResponderStatus.SignedOut]: [statusTransitions.signIn, statusTransitions.standBy, statusTransitions.inTown],
}

const futureStatusOptions: Record<ResponderStatus, { id: number, newStatus: ResponderStatus, text: string }[]> = {
  [ResponderStatus.NotResponding]: [statusTransitions.standBy],
  [ResponderStatus.Standby]: [statusTransitions.standDown],
  [ResponderStatus.Remote]: [statusTransitions.resetStatus],
  [ResponderStatus.SignedIn]: [statusTransitions.resetStatus],
  [ResponderStatus.Available]: [statusTransitions.resetStatus],
  [ResponderStatus.Assigned]: [statusTransitions.resetStatus],
  [ResponderStatus.Demobilized]: [statusTransitions.resetStatus],
  [ResponderStatus.SignedOut]: [statusTransitions.standBy],
}

function getStatusOptions(current: ResponderStatus|undefined, startTime: number) {
  let status = current ?? ResponderStatus.NotResponding;
  if (isFuture(startTime - earlySigninWindow)) {
    return futureStatusOptions[status];
  }
  return statusOptions[status];
}

export const StatusUpdater = ({activity, current}: {activity: Activity, current?: ResponderStatus}) => {
  const user = useAppSelector(state => state.auth.userInfo);
  const thisOrg = useAppSelector(state => state.organization.mine);

  return (user && thisOrg) ? (
    <StatusUpdaterProtected
      activity={activity}
      current={current}
      user={user}
      thisOrg={thisOrg}
    />
   ) : null;
}

const StatusUpdaterProtected = ({activity, current, user, thisOrg}: {activity: Activity, user: UserInfo, thisOrg: MyOrganization, current?: ResponderStatus}) => {
  const [ confirming, setConfirming ] = useState<boolean>(false);
  const [ confirmTitle, setConfirmTitle ] = useState<string>('');
  const [ confirmStatus, setConfirmStatus ] = useState<ResponderStatus>(ResponderStatus.SignedIn);
  const [ confirmLabel, setConfirmLabel ] = useState<string>('');

  current = current ?? activity.participants[user.participantId]?.timeline[0]?.status;

  const formLogic = useFormLogic(
    activity,
    user,
    thisOrg,
    activity.participants[user.participantId],
    current,
    confirmStatus,
    () => setConfirming(false),
  );


  function confirmPrompt(title: string, optionId: number) {
    let option = Object.values(statusTransitions).find(f => f.id === optionId);
    setConfirmTitle(title);
    setConfirmStatus(option?.newStatus ?? 0);
    setConfirmLabel(option?.text ?? '');
    setConfirming(true);
  }

  const actions = getStatusOptions(current, activity.startTime);
  return (
    <>
      <SplitButton
        options={actions}
        selected={actions[0].id}
        onClick={(optionId) => { confirmPrompt('Update Status', optionId)}}
      />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        aria-labelledby="status-update-dialog-title"
        aria-describedby="status-update-dialog-description"
      >
        <form onSubmit={formLogic.doSubmit}>
          <DialogTitle id="status-update-dialog-title">{confirmTitle}</DialogTitle>
          <DialogContent>
            <>
              {!activity.organizations[thisOrg.id] && (<Alert sx={{mb: 1}} severity="warning">You are the first responder for {thisOrg.rosterName}. Make sure you are authorized to commit {thisOrg.rosterName} to this {activity.isMission ? 'mission' : 'event'}.</Alert>)}
              <UpdateStatusForm form={formLogic} />
            </>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button type="submit" autoFocus>{confirmLabel}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

