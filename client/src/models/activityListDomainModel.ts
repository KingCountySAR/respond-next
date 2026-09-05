import type { Activity } from '@respond/shared/types/activity';

import type { AppStore } from '../lib/client/store';

import { ActivityDomainModel } from './activityDomainModel';
import type { ObservableClock } from './observableClock';
import { ReduxProjection } from './reduxProjection';

/**
 * The full activity read model, projected from `state.activities.list`.
 * App-scoped singleton (one per session). Plain getters delegate to the
 * projection's observable, so reading them inside an `observer` tracks the list
 * as server events reduce in. Mirrors `buildActivityTypeSelector`'s mission/event
 * partition as the raw domain facts; view-level filtering/sorting lives in the VM.
 *
 * Also vends a per-activity {@link ActivityDomainModel} ({@link getActivity}) so
 * list rows get the same reactive status/timing derivations as the activity page.
 * Rows are memoized (stable identity across updates) and share this projection's
 * single store subscription rather than each opening their own.
 */
export class ActivityListDomainModel {
  private readonly projection: ReduxProjection<Activity[]>;
  private readonly models = new Map<string, ActivityDomainModel>();

  constructor(
    store: AppStore,
    private readonly clock: ObservableClock,
  ) {
    this.projection = new ReduxProjection(store, (state) => state.activities.list);
  }

  connect() {
    this.projection.connect();
  }

  dispose() {
    this.models.forEach((m) => m.dispose());
    this.models.clear();
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

  /** Every activity in the list as a (stable, memoized) ActivityDomainModel. */
  get activityModels(): ActivityDomainModel[] {
    return this.projection.value.map((a) => this.getActivity(a.id));
  }

  /**
   * The (stable, memoized) domain model for one activity in the list. Reads its
   * activity live out of this projection, so the same instance keeps reacting as
   * the activity updates.
   */
  getActivity(id: string): ActivityDomainModel {
    let model = this.models.get(id);
    if (!model) {
      model = ActivityDomainModel.projected(this.projection, id, this.clock);
      this.models.set(id, model);
    }
    return model;
  }
}
