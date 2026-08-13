import type { Activity } from '@respond/shared/types/activity';

import type { AppStore } from '../lib/client/store';

import { ReduxProjection } from './reduxProjection';

/**
 * The full activity read model, projected from `state.activities.list`.
 * App-scoped singleton (one per session). Plain getters delegate to the
 * projection's observable, so reading them inside an `observer` tracks the list
 * as server events reduce in. Mirrors `buildActivityTypeSelector`'s mission/event
 * partition as the raw domain facts; view-level filtering/sorting lives in the VM.
 */
export class ActivityListDomainModel {
  private readonly projection: ReduxProjection<Activity[]>;

  constructor(store: AppStore) {
    this.projection = new ReduxProjection(store, (state) => state.activities.list);
  }

  connect() {
    this.projection.connect();
  }

  dispose() {
    this.projection.dispose();
  }

  get activities(): Activity[] {
    return this.projection.value;
  }

  get missions(): Activity[] {
    return this.projection.value.filter((a) => a.isMission);
  }

  get events(): Activity[] {
    return this.projection.value.filter((a) => !a.isMission);
  }
}
