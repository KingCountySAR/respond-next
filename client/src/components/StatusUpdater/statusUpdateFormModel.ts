import { makeAutoObservable } from 'mobx';

import { formatTime } from '@respond/lib/timeFormat';
import { ParticipantStatus } from '@respond/shared/types/activity';
import { MemberInfo } from '@respond/shared/types/member';
import { Organization } from '@respond/shared/types/organization';
import { UserInfo } from '@respond/shared/types/userInfo';

import { ActivityDomainModel } from '@/client/models/activityDomainModel';
import { ParticipantDomainModel } from '@/client/models/participantDomainModel';

export interface FormError {
  severity: 'warning' | 'error';
  text: string;
}

export interface StatusFormErrors {
  top?: FormError[];
  statusTime?: FormError;
  miles?: FormError;
}

/** Overall form state: 'error' blocks submit; 'warning' is advisory only; 'valid' is clean. */
export type FormValidity = 'error' | 'warning' | 'valid';

/**
 * The status-update dialog's form — a MobX model owned by {@link StatusUpdaterViewModel}
 * (as `vm.form`, mirroring how ActivityViewModel owns RosterViewModel). Holds the
 * editable field state, validation, and submit, so none of it lives in the JSX and
 * it's testable without rendering. The per-open bits (participant, target status)
 * arrive via {@link reset}; the static deps (activity/user/org) are injected once.
 */
export class StatusUpdateFormModel {
  statusTime = Date.now();
  miles: number | '' = '';
  eta: number | undefined = undefined;

  // Seeded by reset() each time the dialog opens.
  private newStatus: ParticipantStatus = ParticipantStatus.SignedIn;
  private participant: ParticipantDomainModel | undefined = undefined;

  constructor(
    private readonly activity: ActivityDomainModel,
    private readonly user: UserInfo | MemberInfo,
    private readonly respondingOrg: Organization,
    private readonly onFinish: () => void,
  ) {
    makeAutoObservable<StatusUpdateFormModel, 'activity' | 'user' | 'respondingOrg' | 'onFinish'>(this, {
      activity: false,
      user: false,
      respondingOrg: false,
      onFinish: false,
    });
  }

  /** Seed the fields for a fresh open (replaces react-hook-form defaultValues). */
  reset(participant: ParticipantDomainModel | undefined, newStatus: ParticipantStatus) {
    this.participant = participant;
    this.newStatus = newStatus;
    this.statusTime = Date.now();
    this.miles = participant?.miles ?? '';
    this.eta = participant?.eta ?? undefined;
  }

  /** ETA field is shown only when the target status is enroute or standby. */
  get showEta(): boolean {
    return !!ParticipantDomainModel.isEnrouteOrStandby(this.newStatus);
  }

  /** Miles field is shown only when signing out. */
  get showMiles(): boolean {
    return this.newStatus === ParticipantStatus.SignedOut;
  }

  get currentMiles(): number {
    return this.participant?.miles ?? 0;
  }

  get errors(): StatusFormErrors {
    const errors: StatusFormErrors = {};

    if (this.participant?.status === ParticipantStatus.Assigned) {
      errors.top = [...(errors.top ?? []), { severity: 'warning', text: 'You are currently assigned to a Team or Place on the Operations Dashboard. Changing your status may cause a discrepancy.' }];
    }

    if (!this.activity.organizations?.some((o) => o.id === this.respondingOrg.id)) {
      errors.top = [
        ...(errors.top ?? []),
        {
          severity: 'warning',
          text: `You are the first responder for ${this.respondingOrg.rosterName}. Make sure you are authorized to commit ${this.respondingOrg.rosterName} to this ${this.activity.isMission ? 'mission' : 'event'}.`,
        },
      ];
    }

    if (this.miles !== '' && Number(this.miles) < 0) {
      errors.miles = { severity: 'error', text: 'Must be a positive number' };
    }

    if (!this.statusTime) {
      errors.statusTime = { severity: 'error', text: 'Status time is required' };
    }

    const lastStatusChangeTime = this.participant?.timeline[0].time;
    if (lastStatusChangeTime && !isNaN(lastStatusChangeTime) && this.statusTime < lastStatusChangeTime) {
      errors.statusTime = { severity: 'error', text: 'Cannot be earlier than previous status change at ' + formatTime(lastStatusChangeTime) };
    }

    return errors;
  }

  /**
   * The most severe issue on the form: 'error' (a field problem — blocks submit),
   * 'warning' (advisory alerts like first-responder / assigned — shown but never
   * blocking), or 'valid' (clean). Only field-level problems carry 'error'.
   */
  get isValid(): FormValidity {
    const entries = [...(this.errors.top ?? []), this.errors.statusTime, this.errors.miles].filter((e): e is FormError => !!e);
    if (entries.some((e) => e.severity === 'error')) return 'error';
    if (entries.length > 0) return 'warning';
    return 'valid';
  }

  setStatusTime(time: number | null) {
    this.statusTime = time ?? 0;
  }

  setMiles(miles: number | string) {
    this.miles = miles === '' ? '' : Number(miles);
  }

  setEta(eta: number | null) {
    this.eta = eta ?? undefined;
  }

  submit() {
    if (this.isValid === 'error') return;
    this.activity.recordStatusUpdate({
      participantId: 'participantId' in this.user ? this.user.participantId : this.user.id,
      firstName: this.user.given_name ?? '',
      lastName: this.user.family_name ?? '',
      org: { id: this.respondingOrg.id, title: this.respondingOrg.title, rosterName: this.respondingOrg.rosterName },
      time: this.statusTime,
      status: this.newStatus,
      miles: this.miles === '' ? undefined : this.miles,
      eta: this.eta,
    });
    this.onFinish();
  }
}
