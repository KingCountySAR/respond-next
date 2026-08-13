import type { UnknownAction } from '@reduxjs/toolkit';
import { makeObservable, observableRef, runInAction } from 'mobx';

import { Activity } from '@respond/shared/types/activity';

import { addAppListener, type AppDispatch, type AppStore } from '../store';
import { buildActivitySelector } from '../store/activities';

import { ParticipantDomainModel } from './ParticipantDomainModel';

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
  // Initialized here (not just declared) so the fields exist as own properties
  // before makeObservable runs — the repo transpiles with useDefineForClassFields
  // off, where a declared-only field isn't yet present at construction time.
  private storeActivity: Activity | undefined = undefined;
  private fallbackActivity: Activity | undefined = undefined;
  private unsubscribe?: () => void;
  // Stable ParticipantDomainModel per id — each reads its participant live, so the
  // same instance survives updates (only re-created if a participant id is new).
  private readonly participantModels = new Map<string, ParticipantDomainModel>();

  constructor(
    private readonly store: AppStore,
    private readonly activityId: string,
  ) {
    this.storeActivity = this.select();
    makeObservable<ActivityDomainModel, 'storeActivity' | 'fallbackActivity'>(this, {
      // Reference observability only — the Activity graph comes frozen from Redux
      // and is swapped wholesale, so we must not let MobX deep-proxy it.
      storeActivity: observableRef,
      fallbackActivity: observableRef,
    });
  }

  private select(): Activity | undefined {
    return buildActivitySelector(this.activityId)(this.store.getState());
  }

  /**
   * Dispatch a command into the Redux timeline. The domain model owns the sole
   * reference to the store — view models issue commands through here so they stay
   * decoupled from Redux (ClientSync forwards the command; the server event reduces
   * back in via the subscription above).
   */
  get dispatch(): AppDispatch {
    return this.store.dispatch;
  }

  /**
   * Dispatch a command, then resolve once an event whose type is in `eventTypes`
   * is observed on the Redux action stream (via the listener middleware). This is
   * the round-trip completion signal for command → server → event → reduce — e.g.
   * to navigate away only after the delete has actually landed. Rejects if no
   * matching event arrives within `timeoutMs`; the listener is always torn down.
   *
   * Note: matches on event type only, so it resolves on the first such event
   * regardless of which activity it targets. Sufficient for the single-activity
   * page; pass a narrower type set (or add id matching) if that ever bites.
   */
  dispatchAndWait(command: UnknownAction, eventTypes: string[], timeoutMs = 10000): Promise<UnknownAction> {
    const wanted = new Set(eventTypes);
    return new Promise<UnknownAction>((resolve, reject) => {
      let stop = () => {};
      const timer = setTimeout(() => {
        stop();
        reject(new Error(`dispatchAndWait timed out after ${timeoutMs}ms waiting for: ${eventTypes.join(', ')}`));
      }, timeoutMs);
      // Register the listener before dispatching so a fast event can't be missed.
      stop = this.store.dispatch(
        addAppListener({
          predicate: (action) => wanted.has(action.type),
          effect: (action) => {
            stop();
            clearTimeout(timer);
            resolve(action);
          },
        }),
      );
      this.store.dispatch(command);
    });
  }

  /**
   * Begin mirroring the store. Kept out of the constructor so the model can be
   * built during render (pure) and only the committed instance subscribes — this
   * matters under React StrictMode, which builds-and-discards. Idempotent.
   */
  connect() {
    if (this.unsubscribe) return;
    // Re-sync in case the store changed between construction and connect.
    runInAction(() => {
      this.storeActivity = this.select();
    });
    this.unsubscribe = this.store.subscribe(() => {
      const next = this.select();
      if (next !== this.storeActivity) {
        runInAction(() => {
          this.storeActivity = next;
        });
      }
    });
  }

  /** Live store data wins; the fetched fallback fills the not-in-store gap. */
  get activity(): Activity | undefined {
    return this.storeActivity ?? this.fallbackActivity;
  }

  /**
   * Read-only when the activity is absent from the live Redux store — i.e. it was
   * hydrated by ActivityLayout's one-off API fetch of an inactive/archived activity.
   * Such an activity isn't part of the live command/event sync, so no commands may
   * be issued against it. If it later appears in the store (becomes active), this
   * flips back to editable.
   */
  get readOnly(): boolean {
    return this.storeActivity === undefined;
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
    if (!model) {
      model = new ParticipantDomainModel(
        () => this.activity?.participants[participantId],
        () => this.activity?.organizations,
      );
      this.participantModels.set(participantId, model);
    }
    return model;
  }

  /** Every current participant as a (stable) ParticipantDomainModel. */
  get participants(): ParticipantDomainModel[] {
    const activity = this.activity;
    if (!activity) return [];
    return Object.keys(activity.participants)
      .map((id) => this.getParticipant(id))
      .filter((model): model is ParticipantDomainModel => model !== undefined);
  }

  setFallback(activity: Activity | undefined) {
    if (activity !== this.fallbackActivity) {
      runInAction(() => {
        this.fallbackActivity = activity;
      });
    }
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
