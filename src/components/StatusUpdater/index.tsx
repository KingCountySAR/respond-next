import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle  } from '../Material';
import { useAppSelector } from '@respond/lib/client/store';
import { Activity, ResponderStatus } from '@respond/types/activity';
import { MyOrganization } from '@respond/types/organization';
import { UserInfo } from '@respond/types/userInfo';
import { SplitButton } from '../SplitButton';
import { useFormLogic, UpdateStatusForm } from './UpdateStatusForm';

const options = {
  standdown: { id: ResponderStatus.Cancel, text: 'Stand Down' },
  standby: { id: ResponderStatus.Standby, text: 'Stand By' },
  signin: { id: ResponderStatus.SignedIn, text: 'Sign In' },
  signout: { id: ResponderStatus.SignedOut, text: 'Sign Out' },
}
const optionTexts = Object.values(options).reduce((accum, cur) => ({ ...accum, [cur.id]: cur.text }), {} as Record<string, string>);

function isFuture(time: number) {
  return (time - 60 * 60 * 1000) > new Date().getTime();
};

function getRecommendedAction(current: ResponderStatus|undefined, startTime: number): ResponderStatus {
  if (current === ResponderStatus.SignedIn) {
    return ResponderStatus.SignedOut;
  }
  if (isFuture(startTime)) {
    return current === ResponderStatus.Standby ? ResponderStatus.Cancel : ResponderStatus.Standby;
  }
  return ResponderStatus.SignedIn;
}

function getCurrentOptions(current: ResponderStatus|undefined, startTime: number) {
  if (isFuture(startTime)) {
    return current === ResponderStatus.Standby ? [options.standdown] : [options.standby];
  }
  if (current === ResponderStatus.Standby) {
    return [options.signin, options.standdown];
  }
  if (current === ResponderStatus.SignedIn) {
    return [options.signout];
  }
  if (current === ResponderStatus.SignedOut) {
    return [options.signin, options.standby];
  }
  return [options.signin, options.standby];
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

  current = current ?? activity.participants[user.participantId]?.timeline[0]?.status;

  const formLogic = useFormLogic(
    activity,
    user,
    thisOrg.id,
    activity.participants[user.participantId],
    current,
    confirmStatus,
    () => setConfirming(false),
  );


  function confirmPrompt(title: string, newStatus: ResponderStatus) {
    setConfirmTitle(title);
    setConfirmStatus(newStatus);
    setConfirming(true);
  }

  const currentOptions = getCurrentOptions(current, activity.startTime);
  const recommendedAction = getRecommendedAction(current, activity.startTime);
  return (
    <>
      <SplitButton
        options={currentOptions}
        selected={recommendedAction}
        onClick={(newStatus) => { confirmPrompt('Update Status', newStatus)}}
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
            <UpdateStatusForm form={formLogic} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button type="submit" autoFocus>{optionTexts[confirmStatus]}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

