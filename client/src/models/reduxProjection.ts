import type { UnknownAction } from '@reduxjs/toolkit';
import { makeObservable, observableRef, runInAction } from 'mobx';

import { addAppListener, type AppDispatch, type AppStore, type RootState } from '../lib/client/store';

/**
 * Mirrors a Redux selector result into a single MobX `observableRef`. The core
 * Redux→MobX bridge shared by the domain models: reducers hand out fresh, frozen
 * values, so reference observability is all we need — MobX swaps the ref when the
 * selection changes and downstream computeds recompute. Redux stays the source of
 * truth; this is a pure projection (time-travel drives it via the subscription).
 *
 * `connect()`/`dispose()` are split from the constructor so a model can be built
 * during render (pure) and only the committed instance subscribes (StrictMode).
 */
export class ReduxProjection<T> {
  private current: T;
  private unsubscribe?: () => void;

  constructor(
    private readonly store: AppStore,
    private readonly selector: (state: RootState) => T,
  ) {
    // Assign before makeObservable so the field is an own property when MobX
    // annotates it (repo builds with useDefineForClassFields off).
    this.current = selector(store.getState());
    makeObservable<ReduxProjection<T>, 'current'>(this, { current: observableRef });
  }

  connect() {
    if (this.unsubscribe) return;
    // Re-sync in case the store changed between construction and connect.
    runInAction(() => {
      this.current = this.selector(this.store.getState());
    });
    this.unsubscribe = this.store.subscribe(() => {
      const next = this.selector(this.store.getState());
      if (next !== this.current) {
        runInAction(() => {
          this.current = next;
        });
      }
    });
  }

  get value(): T {
    return this.current;
  }

  /**
   * Dispatch a command into the Redux timeline — the write side of the bridge.
   * The projection owns the sole store reference, so domain models issue commands
   * through here and stay decoupled from Redux (ClientSync forwards the command;
   * the server event reduces back in via the subscription above).
   */
  get dispatch(): AppDispatch {
    return this.store.dispatch;
  }

  /**
   * Dispatch a command, then resolve once an event whose type is in `eventTypes`
   * is observed on the Redux action stream (via the listener middleware) — the
   * round-trip completion signal for command → server → event → reduce (e.g. to
   * navigate away only after a delete has landed). Rejects if no matching event
   * arrives within `timeoutMs`; the listener is always torn down.
   *
   * Matches on event type only, so it resolves on the first such event regardless
   * of target. Pass a narrower type set (or add id matching) if that ever bites.
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

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
