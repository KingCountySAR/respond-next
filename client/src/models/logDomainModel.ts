import { makeAutoObservable } from 'mobx';

import { CommunicationsLogEntry } from '@respond/shared/types/operations';

/**
 * Domain model for a single communications-log entry. Built with a LIVE accessor
 * so one instance keeps reacting as the entry is edited (favorited, soft-deleted)
 * in the Redux read model — see {@link TeamDomainModel}; memoized per id by
 * OperationDomainModel.
 */
export class LogDomainModel {
  constructor(private readonly getEntry: () => CommunicationsLogEntry | undefined) {
    makeAutoObservable<LogDomainModel, 'getEntry'>(this, { getEntry: false });
  }

  /** The backing entry, or undefined once it's gone from the activity. */
  get entry(): CommunicationsLogEntry | undefined {
    return this.getEntry();
  }

  /** Whether the entry still exists — guards the asserting field getters below. */
  get exists(): boolean {
    return !!this.getEntry();
  }

  get id(): string {
    return this.entry!.id;
  }

  get message(): string {
    return this.entry!.message;
  }

  get from(): string | undefined {
    return this.entry?.from;
  }

  get to(): string | undefined {
    return this.entry?.to;
  }

  get timestamp(): number {
    return this.entry!.timestamp;
  }

  get isAutomated(): boolean {
    return this.entry?.isAutomated ?? false;
  }

  get isDeleted(): boolean {
    return this.entry?.isDeleted ?? false;
  }

  get isFavorite(): boolean {
    return this.entry?.isFavorite ?? false;
  }

  dispose() {}
}
