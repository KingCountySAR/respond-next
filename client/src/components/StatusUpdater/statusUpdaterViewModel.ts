import { makeAutoObservable } from 'mobx';

import { ParticipantStatus } from '@respond/shared/types/activity';
import { MemberInfo } from '@respond/shared/types/member';
import { Organization } from '@respond/shared/types/organization';
import { UserInfo } from '@respond/shared/types/userInfo';

import { ActivityDomainModel } from '@/client/models/activityDomainModel';
import { ParticipantDomainModel } from '@/client/models/participantDomainModel';
import { Transition, transitionById } from '@/client/models/statusTransitions';

import { StatusUpdateFormModel } from './statusUpdateFormModel';

/**
 * Component-scoped view model for the StatusUpdater (mirrors ActivityViewModel).
 * Holds the confirm-dialog state as a coupled cluster (title/status/label are
 * derived together, not just an open boolean) and the derived facts the view
 * binds to, and owns the form as a child model ({@link form}, like ActivityViewModel
 * owns RosterViewModel). Command dispatch lives on the domain model
 * ({@link ActivityDomainModel.recordStatusUpdate}); the transition rules on
 * {@link ActivityDomainModel.getStatusTransitions}.
 */
export class StatusUpdaterViewModel {
  confirming = false;
  confirmTitle = '';
  confirmStatus: ParticipantStatus = ParticipantStatus.SignedIn;
  confirmLabel = '';

  /** Form-input state/validation/submit for the confirm dialog. */
  readonly form: StatusUpdateFormModel;

  constructor(
    readonly activity: ActivityDomainModel,
    readonly user: UserInfo | MemberInfo,
    readonly respondingOrg: Organization,
  ) {
    this.form = new StatusUpdateFormModel(activity, user, respondingOrg, () => this.close());
    makeAutoObservable<StatusUpdaterViewModel, 'activity' | 'user' | 'respondingOrg'>(this, {
      activity: false,
      user: false,
      respondingOrg: false,
      form: false, // the child model owns its own reactivity
    });
  }

  get participantId(): string {
    return 'participantId' in this.user ? this.user.participantId : this.user.id;
  }

  /** The plain participant record, or undefined if this responder isn't in the activity yet. */
  get participant(): ParticipantDomainModel | undefined {
    return this.activity.participants.find((p) => p.id === this.participantId);
  }

  get current(): ParticipantStatus | undefined {
    return this.participant?.timeline[0]?.status;
  }

  /** The status-change options for the SplitButton. */
  get actions(): Transition[] {
    return this.activity.getStatusTransitions(this.current, this.participant?.timeline[0]?.organizationId, this.respondingOrg.id);
  }

  get activityTitle(): string {
    return this.activity.activity?.title ?? '';
  }

  get isMission(): boolean {
    return !!this.activity.activity?.isMission;
  }

  /** Open the confirmation dialog for the chosen SplitButton option. */
  openConfirm(optionId: number, title = 'Update Status') {
    const option = transitionById(optionId);
    this.confirmTitle = title;
    this.confirmStatus = option?.newStatus ?? ParticipantStatus.NotResponding;
    this.confirmLabel = option?.text ?? '';
    this.form.reset(this.participant, this.confirmStatus);
    this.confirming = true;
  }

  close() {
    this.confirming = false;
  }
}
