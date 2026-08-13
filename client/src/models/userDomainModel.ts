import type { UserInfo } from '@respond/shared/types/userInfo';

import type { AppStore } from '../lib/client/store';

import { ReduxProjection } from './reduxProjection';

/**
 * The logged-in user, projected from `state.auth.userInfo`. App-scoped singleton
 * (one per session). Plain getters delegate to the projection's observable, so
 * reading them inside an `observer` tracks auth changes (login/logout).
 */
export class UserDomainModel {
  private readonly projection: ReduxProjection<UserInfo | undefined>;

  constructor(store: AppStore) {
    this.projection = new ReduxProjection(store, (state) => state.auth.userInfo);
  }

  connect() {
    this.projection.connect();
  }

  dispose() {
    this.projection.dispose();
  }

  get userInfo(): UserInfo | undefined {
    return this.projection.value;
  }

  get isLoggedIn(): boolean {
    return !!this.projection.value;
  }

  get participantId(): string | undefined {
    return this.projection.value?.participantId;
  }

  get organizationId(): string | undefined {
    return this.projection.value?.organizationId;
  }

  get name(): string | undefined {
    return this.projection.value?.name;
  }
}
