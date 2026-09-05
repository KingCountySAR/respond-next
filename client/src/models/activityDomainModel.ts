import type { UnknownAction } from '@reduxjs/toolkit';
import { makeObservable, observableRef, runInAction } from 'mobx';

import { ActivityCommands, ParticipantCommands } from '@respond/shared/commands';
import { ActivityEvents } from '@respond/shared/events';
import { Activity, defaultEarlySigninWindow, getOrganizationName, isActive, isActive as isParticipantActive, isResponding, OrganizationStatus, ParticipantStatus } from '@respond/shared/types/activity';
import { Location } from '@respond/shared/types/location';

import { type AppDispatch, type AppStore } from '../lib/client/store';
import { buildActivitySelector } from '../lib/client/store/activities';

import { ObservableClock } from './observableClock';
import { ParticipantDomainModel } from './participantDomainModel';
import { ParticipatingOrgDomainModel } from './participatingOrgDomainModel';
import { ReduxProjection } from './reduxProjection';
import { pickStatusOptions, statusTransitions, Transition } from './statusTransitions';

/**
 * The read/write surface a domain model needs from Redux, abstracted so one
 * `ActivityDomainModel` can be backed two ways:
 *  - {@link StoreActivitySource}: the activity page's single-activity projection
 *    (owns its own store subscription + the read-only fallback), and
 *  - {@link ProjectedActivitySource}: a row in the activity list, reading its
 *    activity out of the list projection the {@link ActivityListDomainModel}
 *    already subscribes to (so rows are cheap — no per-row subscription).
 */
interface ActivitySource {
  readonly activity: Activity | undefined;
  readonly readOnly: boolean;
  readonly dispatch: AppDispatch;
  dispatchAndWait(command: UnknownAction, eventTypes: string[], timeoutMs?: number): Promise<UnknownAction>;
  connect(): void;
  dispose(): void;
  setFallback(activity: Activity | undefined): void;
}

/**
 * Single-activity source: mirrors one activity out of the store via its own
 * projection, plus a `fallbackActivity` for activities not in the live store
 * (e.g. an old closed activity opened by direct link, hydrated by ActivityLayout's
 * one-off fetch). Read-only when the activity is absent from the live store.
 */
class StoreActivitySource implements ActivitySource {
  private readonly projection: ReduxProjection<Activity | undefined>;
  // Initialized here (not just declared) so the field exists as an own property
  // before makeObservable runs — the repo transpiles with useDefineForClassFields
  // off, where a declared-only field isn't yet present at construction time.
  private fallback: Activity | undefined = undefined;

  constructor(store: AppStore, activityId: string) {
    this.projection = new ReduxProjection(store, buildActivitySelector(activityId));
    makeObservable<StoreActivitySource, 'fallback'>(this, {
      // Reference observability only — the Activity graph comes frozen from Redux
      // and is swapped wholesale, so we must not let MobX deep-proxy it.
      fallback: observableRef,
    });
  }

  /** Live store data wins; the fetched fallback fills the not-in-store gap. */
  get activity(): Activity | undefined {
    return this.projection.value ?? this.fallback;
  }

  get readOnly(): boolean {
    return this.projection.value === undefined;
  }

  get dispatch(): AppDispatch {
    return this.projection.dispatch;
  }

  dispatchAndWait(command: UnknownAction, eventTypes: string[], timeoutMs?: number): Promise<UnknownAction> {
    return this.projection.dispatchAndWait(command, eventTypes, timeoutMs);
  }

  connect() {
    this.projection.connect();
  }

  dispose() {
    this.projection.dispose();
  }

  setFallback(activity: Activity | undefined) {
    if (activity !== this.fallback) {
      runInAction(() => {
        this.fallback = activity;
      });
    }
  }
}

/**
 * List-row source: reads one activity out of the shared list projection the
 * owning {@link ActivityListDomainModel} already subscribes to. There's no
 * per-row subscription or lifecycle — connect/dispose/setFallback are no-ops —
 * and commands ride the list projection's dispatch. A row is read-only only if
 * its activity has dropped out of the list.
 */
class ProjectedActivitySource implements ActivitySource {
  constructor(
    private readonly projection: ReduxProjection<Activity[]>,
    private readonly activityId: string,
  ) {}

  get activity(): Activity | undefined {
    return this.projection.value.find((a) => a.id === this.activityId);
  }

  get readOnly(): boolean {
    return this.activity === undefined;
  }

  get dispatch(): AppDispatch {
    return this.projection.dispatch;
  }

  dispatchAndWait(command: UnknownAction, eventTypes: string[], timeoutMs?: number): Promise<UnknownAction> {
    return this.projection.dispatchAndWait(command, eventTypes, timeoutMs);
  }

  connect() {}
  dispose() {}
  setFallback() {}
}

/**
 * Bridges the Redux read-model into MobX for a single activity, exposing its
 * derived facts (status, timing, active responders) as getters that read the
 * frozen Activity ref (swapped wholesale by reducers) and the ObservableClock —
 * so the time-dependent ones recompute as the activity crosses its start time /
 * sign-in window, and any `observer` reading them re-renders live.
 *
 * This keeps the command → event → reduce timeline (and RTK devtools time-travel)
 * as the sole source of truth; MobX is a pure downstream projection. Backing comes
 * from an {@link ActivitySource}: {@link ActivityDomainModel.forStore} for the
 * activity page, {@link ActivityDomainModel.projected} for a list row.
 */
export class ActivityDomainModel {
  // Stable ParticipantDomainModel per id — each reads its participant live, so the
  // same instance survives updates (only re-created if a participant id is new).
  private readonly participantModels = new Map<string, ParticipantDomainModel>();
  // Same stable-per-id memoization for participating organizations.
  private readonly organizationModels = new Map<string, ParticipatingOrgDomainModel>();

  private constructor(
    private readonly source: ActivitySource,
    private readonly activityId: string,
    private readonly clock: ObservableClock,
  ) {}

  /** Store-backed model for the activity page (owns a store subscription + fallback). */
  static forStore(store: AppStore, activityId: string, clock: ObservableClock): ActivityDomainModel {
    return new ActivityDomainModel(new StoreActivitySource(store, activityId), activityId, clock);
  }

  /** Row model over a shared list projection — cheap, no per-row subscription. */
  static projected(projection: ReduxProjection<Activity[]>, activityId: string, clock: ObservableClock): ActivityDomainModel {
    return new ActivityDomainModel(new ProjectedActivitySource(projection, activityId), activityId, clock);
  }

  /** Dispatch a command into the Redux timeline (delegated to the source). */
  get dispatch(): AppDispatch {
    return this.source.dispatch;
  }

  /**
   * Dispatch a command and resolve once a matching event has reduced back in — the
   * command → server → event → reduce round-trip signal (e.g. navigate away only
   * after a delete lands). See {@link ReduxProjection.dispatchAndWait}.
   */
  dispatchAndWait(command: UnknownAction, eventTypes: string[], timeoutMs?: number): Promise<UnknownAction> {
    return this.source.dispatchAndWait(command, eventTypes, timeoutMs);
  }

  /**
   * Begin mirroring the store. Kept out of the constructor so the model can be
   * built during render (pure) and only the committed instance subscribes — this
   * matters under React StrictMode, which builds-and-discards. Idempotent. (No-op
   * for a list-row model; the list owns the subscription.)
   */
  connect() {
    this.source.connect();
  }

  get activity(): Activity | undefined {
    return this.source.activity;
  }

  /**
   * Read-only when the activity is absent from the live Redux store — i.e. it was
   * hydrated by ActivityLayout's one-off API fetch of an inactive/archived activity.
   * Such an activity isn't part of the live command/event sync, so no commands may
   * be issued against it. If it later appears in the store (becomes active), this
   * flips back to editable.
   */
  get readOnly(): boolean {
    return this.source.readOnly;
  }

  get organizationName(): string {
    return this.activity?.organizations[this.activity.ownerOrgId]?.title ?? '';
  }

  // --- Derived status / timing. The time-dependent ones read the observable clock
  // so they recompute as the activity crosses its start / sign-in window. (This is
  // the sole home for the activity-status logic that used to live in the slice.)

  get isComplete(): boolean {
    return !!this.activity?.endTime;
  }

  get isActive(): boolean {
    return !!this.activity && !this.isComplete;
  }

  /** Active and past its sign-in window (open immediately when no window is set). */
  get isOpen(): boolean {
    const activity = this.activity;
    if (!activity) return false;
    return this.isActive && (!activity.earlySignInWindow || activity.startTime - activity.earlySignInWindow <= this.clock.time);
  }

  /** Active and past its start time. */
  get isStarted(): boolean {
    const activity = this.activity;
    if (!activity) return false;
    return this.isActive && activity.startTime <= this.clock.time;
  }

  /** Active but not yet open for sign in. */
  get isPending(): boolean {
    return this.isActive && !this.isOpen;
  }

  /** True while the activity's start time is still in the future. */
  get startsInFuture(): boolean {
    const activity = this.activity;
    return !!activity && activity.startTime > this.clock.time;
  }

  /** Human-readable status label ('Not Started', 'In Progress', 'Closed', …). */
  get statusText(): string {
    if (!this.activity) return '';
    if (this.isComplete) return 'Closed';
    if (this.isStarted) return 'In Progress';
    if (this.isOpen) return 'Open For Sign In';
    if (this.isPending) return 'Not Started';
    return '';
  }

  /** Count of currently-active responders (Standby counts as active). */
  get activeParticipantCount(): number {
    const activity = this.activity;
    if (!activity) return 0;
    return Object.values(activity.participants).filter((p) => isParticipantActive(p.timeline[0].status)).length;
  }

  /** Route path to this activity's page ('/mission/:id' or '/event/:id'). */
  get path(): string {
    const activity = this.activity;
    return activity ? `/${activity.isMission ? 'mission' : 'event'}/${activity.id}` : '/';
  }

  // --- Backing activity fields, surfaced so consumers bind to the domain model
  // instead of reaching into `.activity`. These assume a loaded activity (the
  // detail pages gate rendering on `activity` being present, and the model already
  // reads `this.activity!` elsewhere);

  /** Whether a backing activity is present — guards the asserting field getters below. */
  get activityLoaded(): boolean {
    return !!this.activity;
  }

  get id(): string {
    return this.activity!.id;
  }

  get idNumber(): string {
    return this.activity!.idNumber;
  }

  get title(): string {
    return this.activity!.title;
  }

  get description(): string {
    return this.activity!.description;
  }

  get location(): Location {
    return this.activity!.location;
  }

  get mapId(): string {
    return this.activity!.mapId;
  }

  get isMission(): boolean {
    return this.activity!.isMission;
  }

  get startTime(): number {
    return this.activity!.startTime;
  }

  get endTime(): number | undefined {
    return this.activity?.endTime;
  }

  get forceStandbyOnly(): boolean {
    return this.activity!.forceStandbyOnly;
  }

  get earlySignInWindow(): number | undefined {
    return this.activity!.earlySignInWindow;
  }

  get participantCountByStatus(): Record<ParticipantStatus, number> {
    // Seed every status at 0 (numeric enum values only — Object.values also yields
    // the reverse-mapped names), then tally each participant's current status.
    const counts = {} as Record<ParticipantStatus, number>;
    for (const status of Object.values(ParticipantStatus)) {
      if (typeof status === 'number') counts[status] = 0;
    }
    for (const participant of Object.values(this.activity?.participants ?? {})) {
      counts[participant.timeline[0].status]++;
    }
    return counts;
  }

  /**
   * The domain model for a participant by id, or undefined if they aren't in the
   * activity right now. Instances are memoized so identity is stable across
   * updates (and across removal→re-add); the model reads its participant live.
   */
  getParticipant(participantId: string | undefined): ParticipantDomainModel | undefined {
    if (!participantId || !this.activity?.participants[participantId]) {
      return undefined;
    }
    let model = this.participantModels.get(participantId);
    if (!model && this.activity) {
      model = new ParticipantDomainModel(
        () => this.activity!.participants[participantId],
        () => this.activity!.organizations,
        this.clock,
        this.activityId,
        this.dispatch,
      );
      this.participantModels.set(participantId, model);
    }
    return model;
  }

  /** Every current participant as a (stable) ParticipantDomainModel. */
  get participants(): ParticipantDomainModel[] {
    const activity = this.activity;
    if (!activity) return [];
    return Object.keys(activity.participants).map((id) => this.getParticipant(id)!);
  }

  /**
   * The domain model for a participating org by id, or undefined if it isn't in the
   * activity right now. Memoized so identity is stable across updates; the model
   * reads its org (and the roster, for its responder count) live.
   */
  getOrganization(organizationId: string | undefined): ParticipatingOrgDomainModel | undefined {
    if (!organizationId || !this.activity?.organizations[organizationId]) {
      return undefined;
    }
    let model = this.organizationModels.get(organizationId);
    if (!model && this.activity) {
      model = new ParticipatingOrgDomainModel(
        () => this.activity!.organizations[organizationId],
        () => this.activity!.participants,
      );
      this.organizationModels.set(organizationId, model);
    }
    return model;
  }

  /** Every participating organization as a (stable) ParticipatingOrgDomainModel. */
  get organizations(): ParticipatingOrgDomainModel[] {
    const activity = this.activity;
    if (!activity) return [];
    return Object.keys(activity.organizations).map((id) => this.getOrganization(id)!);
  }

  /**
   * The status-change options to offer a responder in `respondingOrgId` whose
   * current status is `current` (last recorded under `lastOrgId`). Reads the
   * observable clock so options recompute as the activity crosses its sign-in
   * window. Two shapes:
   *  - Cross-org: an active responder acting under a different org than their last
   *    update gets a "Switch from <org>" / "Sign Out from <org>" pair.
   *  - Otherwise: the normal (or standby-only) options for `current`. Standby-only
   *    applies while sign-in hasn't opened, or when the activity is standby-only and
   *    the responder isn't already responding.
   */
  getStatusTransitions(current: ParticipantStatus | undefined, lastOrgId: string | undefined, respondingOrgId: string): Transition[] {
    if (current !== undefined && isActive(current) && respondingOrgId !== lastOrgId) {
      let transition: Transition;
      switch (current) {
        case ParticipantStatus.Remote:
          transition = statusTransitions.inTown;
          break;
        case ParticipantStatus.Standby:
          transition = statusTransitions.standBy;
          break;
        default:
          transition = statusTransitions.signIn;
      }
      const fromName = getOrganizationName(this.activity!, lastOrgId!);
      return [
        { ...transition, text: `Switch from ${fromName}` },
        { ...statusTransitions.signOut, text: `Sign Out from ${fromName}` },
      ];
    }

    const earlySignInWindow = this.earlySignInWindow ?? defaultEarlySigninWindow;
    const standbyOnly = this.startTime - earlySignInWindow > this.clock.time || (this.forceStandbyOnly && !(current !== undefined && isResponding(current)));
    return pickStatusOptions(current, standbyOnly);
  }

  // --- Command actions (dispatched into the Redux timeline) ---

  /**
   * Record a responder's status change. The first responder for an org brings that
   * org onto the activity, so append its timeline entry first, then the participant
   * update. No-op when read-only or unloaded.
   */
  recordStatusUpdate(p: { participantId: string; firstName: string; lastName: string; org: { id: string; title: string; rosterName?: string }; time: number; status: ParticipantStatus; miles?: number; eta?: number }) {
    const activity = this.activity;
    if (!activity || this.readOnly) return;
    if (!activity.organizations[p.org.id]) {
      this.dispatch(
        ActivityCommands.AppendOrganizationTimeline(activity.id, p.org, {
          status: p.status === ParticipantStatus.Standby ? OrganizationStatus.Standby : OrganizationStatus.Responding,
          time: p.time,
        }),
      );
    }
    this.dispatch(ParticipantCommands.UpdateParticipant(activity.id, p.participantId, p.firstName, p.lastName, p.org.id, p.time, p.status, p.miles, p.eta));
  }

  /** Mark this activity complete as of now. No-op when read-only or unloaded. */
  markComplete() {
    const activity = this.activity;
    if (!activity || this.readOnly) return;
    this.dispatch(ActivityCommands.CompleteActivity(activity.id, Date.now()));
  }

  /** Reactivate a completed activity. No-op when read-only or unloaded. */
  reactivate() {
    const activity = this.activity;
    if (!activity || this.readOnly) return;
    this.dispatch(ActivityCommands.ReactivateActivity(activity.id));
  }

  /**
   * Remove (soft-delete) this activity, resolving once the ActivityRemoved event
   * has reduced back in so callers can safely navigate away. No-op when read-only.
   */
  async remove() {
    const activity = this.activity;
    if (!activity || this.readOnly) return;
    await this.dispatchAndWait(ActivityCommands.RemoveActivity(activity.id), [ActivityEvents.ActivityRemoved.type]);
  }

  setFallback(activity: Activity | undefined) {
    this.source.setFallback(activity);
  }

  dispose() {
    this.source.dispose();
    this.participantModels.forEach((p) => p.dispose());
    this.organizationModels.forEach((o) => o.dispose());
  }
}
