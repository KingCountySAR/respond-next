import type { UnknownAction } from '@reduxjs/toolkit';
import { makeObservable, observableRef, runInAction } from 'mobx';

import { ActivityCommands } from '@respond/shared/commands';
import { ActivityEvents } from '@respond/shared/events';
import { Activity } from '@respond/shared/types/activity';

import { type AppDispatch, type AppStore } from '../lib/client/store';
import { buildActivitySelector } from '../lib/client/store/activities';

import { ObservableClock } from './observableClock';
import { ParticipantDomainModel } from './participantDomainModel';
import { ReduxProjection } from './reduxProjection';

/**
 * Bridges the Redux read-model into MobX for a single activity.
 *
 * The `activities` slice replaces each `Activity` with a fresh immutable object
 * on every server event, so we only need reference observability (`observable.ref`)
 * — MobX just swaps the reference when the selected activity changes. This keeps
 * the command → event → reduce timeline (and RTK devtools time-travel) as the sole
 * source of truth; MobX is a pure downstream projection. Rewinding the store fires
 * the subscription and the projection follows.
 *
 * `fallbackActivity` covers activities not present in the store (e.g. an old closed
 * activity opened by direct link, hydrated by ActivityLayout's one-off fetch).
 */
export class ActivityDomainModel {
  // The live store activity, mirrored via the shared Redux→MobX projection.
  private readonly storeActivity: ReduxProjection<Activity | undefined>;
  // Initialized here (not just declared) so the field exists as an own property
  // before makeObservable runs — the repo transpiles with useDefineForClassFields
  // off, where a declared-only field isn't yet present at construction time.
  private fallbackActivity: Activity | undefined = undefined;
  // Stable ParticipantDomainModel per id — each reads its participant live, so the
  // same instance survives updates (only re-created if a participant id is new).
  private readonly participantModels = new Map<string, ParticipantDomainModel>();

  constructor(
    store: AppStore,
    private readonly activityId: string,
    private readonly clock: ObservableClock,
  ) {
    this.storeActivity = new ReduxProjection(store, buildActivitySelector(activityId));
    makeObservable<ActivityDomainModel, 'fallbackActivity'>(this, {
      // Reference observability only — the Activity graph comes frozen from Redux
      // and is swapped wholesale, so we must not let MobX deep-proxy it.
      fallbackActivity: observableRef,
    });
  }

  /** Dispatch a command into the Redux timeline (delegated to the projection). */
  get dispatch(): AppDispatch {
    return this.storeActivity.dispatch;
  }

  /**
   * Dispatch a command and resolve once a matching event has reduced back in — the
   * command → server → event → reduce round-trip signal (e.g. navigate away only
   * after a delete lands). Delegated to the projection; see {@link ReduxProjection.dispatchAndWait}.
   */
  dispatchAndWait(command: UnknownAction, eventTypes: string[], timeoutMs?: number): Promise<UnknownAction> {
    return this.storeActivity.dispatchAndWait(command, eventTypes, timeoutMs);
  }

  /**
   * Begin mirroring the store. Kept out of the constructor so the model can be
   * built during render (pure) and only the committed instance subscribes — this
   * matters under React StrictMode, which builds-and-discards. Idempotent.
   */
  connect() {
    this.storeActivity.connect();
  }

  /** Live store data wins; the fetched fallback fills the not-in-store gap. */
  get activity(): Activity | undefined {
    return this.storeActivity.value ?? this.fallbackActivity;
  }

  /**
   * Read-only when the activity is absent from the live Redux store — i.e. it was
   * hydrated by ActivityLayout's one-off API fetch of an inactive/archived activity.
   * Such an activity isn't part of the live command/event sync, so no commands may
   * be issued against it. If it later appears in the store (becomes active), this
   * flips back to editable.
   */
  get readOnly(): boolean {
    return this.storeActivity.value === undefined;
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

  // --- Command actions (dispatched into the Redux timeline) ---

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
    if (activity !== this.fallbackActivity) {
      runInAction(() => {
        this.fallbackActivity = activity;
      });
    }
  }

  dispose() {
    this.storeActivity.dispose();
    Object.values(this.participantModels).forEach((p) => p.dispose());
  }
}
