import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';

import { useAppSelector } from '@respond/lib/client/store';
import { MemberInfo } from '@respond/shared/types/member';
import { Organization } from '@respond/shared/types/organization';
import { UserInfo } from '@respond/shared/types/userInfo';

import { ActivityDomainModel } from '@/client/models/activityDomainModel';

import { DialogWithHistory } from '../Material';
import { SplitButton } from '../SplitButton';

import { StatusUpdaterViewModel } from './statusUpdaterViewModel';
import { UpdateStatusForm } from './UpdateStatusForm';

export const StatusUpdater = ({ member, organization, fullWidth, activity }: { member?: MemberInfo; organization?: Organization; fullWidth?: boolean; activity: ActivityDomainModel }) => {
  const user = useAppSelector((state) => state.auth.userInfo);
  const thisOrg = useAppSelector((state) => state.organization.mine);

  return user && thisOrg ? <StatusUpdaterProtected activity={activity} user={member || user} thisOrg={organization || thisOrg} fullWidth={fullWidth} /> : null;
};

const StatusUpdaterProtected = observer(({ fullWidth, user, thisOrg, activity }: { user: UserInfo | MemberInfo; fullWidth?: boolean; thisOrg: Organization; activity: ActivityDomainModel }) => {
  const vm = useMemo(() => new StatusUpdaterViewModel(activity, user, thisOrg), [activity, user, thisOrg]);

  return (
    <>
      <SplitButton options={vm.actions} selected={vm.actions[0].id} fullWidth={fullWidth} onClick={(optionId) => vm.openConfirm(optionId)} />
      <DialogWithHistory open={vm.confirming} onClose={() => vm.close()} aria-labelledby="status-update-dialog-title" aria-describedby="status-update-dialog-description">
        {/* Mounted only while open (the dialog unmounts its children on close), so the form starts fresh each time. */}
        <UpdateStatusForm vm={vm} />
      </DialogWithHistory>
    </>
  );
});
