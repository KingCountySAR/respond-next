import { makeAutoObservable } from 'mobx';

import { EquipmentItem, isDefaultPlace, Place } from '@respond/shared/types/operations';

import { ParticipantDomainModel } from './participantDomainModel';

/**
 * Domain model for a single place: its display facts as computeds, plus its
 * assigned members resolved to (stable) {@link ParticipantDomainModel}s. Built
 * with LIVE accessors so one instance keeps reacting as the place changes — see
 * {@link TeamDomainModel}; memoized per id by OperationDomainModel.
 */
export class PlaceDomainModel {
  constructor(
    private readonly getPlace: () => Place | undefined,
    private readonly resolveParticipant: (id: string) => ParticipantDomainModel | undefined,
  ) {
    makeAutoObservable<PlaceDomainModel, 'getPlace' | 'resolveParticipant'>(this, { getPlace: false, resolveParticipant: false });
  }

  /** The backing place, or undefined once it's been removed from the activity. */
  get place(): Place | undefined {
    return this.getPlace();
  }

  /** Whether the place still exists — guards the asserting field getters below. */
  get exists(): boolean {
    return !!this.getPlace();
  }

  get id(): string {
    return this.place!.id;
  }

  get name(): string {
    return this.place!.name;
  }

  get lat(): string | undefined {
    return this.place?.lat;
  }

  get lon(): string | undefined {
    return this.place?.lon;
  }

  get notes(): string | undefined {
    return this.place?.notes;
  }

  /** True for the server-seeded Command Post / Field places. */
  get isDefault(): boolean {
    return this.exists && isDefaultPlace(this.place!);
  }

  get assignedParticipantIds(): string[] {
    return this.place?.assignedParticipants ?? [];
  }

  get assignedEquipment(): EquipmentItem[] {
    return this.place?.assignedEquipment ?? [];
  }

  /**
   * The assigned responders as ParticipantDomainModels. Ids that no longer resolve
   * are dropped; identity is stable (from the activity's memoized per-id cache).
   */
  get members(): ParticipantDomainModel[] {
    return this.assignedParticipantIds.map((id) => this.resolveParticipant(id)).filter((p): p is ParticipantDomainModel => !!p);
  }

  dispose() {}
}
