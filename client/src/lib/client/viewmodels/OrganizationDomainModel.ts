import type { MyOrganization } from '@respond/shared/types/organization';

import type { AppStore } from '../store';

import { ReduxProjection } from './ReduxProjection';

/**
 * The site tenant organization, projected from `state.organization.mine`.
 * App-scoped singleton. Computeds mirror the existing organization selectors
 * (canCreateMissions/canCreateEvents) so views can read them reactively.
 */
export class OrganizationDomainModel {
  private readonly projection: ReduxProjection<MyOrganization | undefined>;

  constructor(store: AppStore) {
    this.projection = new ReduxProjection(store, (state) => state.organization.mine);
  }

  connect() {
    this.projection.connect();
  }

  dispose() {
    this.projection.dispose();
  }

  get organization(): MyOrganization | undefined {
    return this.projection.value;
  }

  get isLoaded(): boolean {
    return !!this.projection.value;
  }

  get canCreateMissions(): boolean {
    const org = this.projection.value;
    return !!org && (org.canCreateMissions || org.partners.some((p) => p.canCreateMissions));
  }

  get canCreateEvents(): boolean {
    const org = this.projection.value;
    return !!org && (org.canCreateEvents || org.partners.some((p) => p.canCreateEvents));
  }
}
