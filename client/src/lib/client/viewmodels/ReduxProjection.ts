import { makeObservable, observableRef, runInAction } from 'mobx';

import type { AppStore, RootState } from '../store';

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

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
