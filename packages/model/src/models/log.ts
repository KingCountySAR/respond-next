/**
 * An activity's log (see `@sync/domain`'s activityLog.ts): a readable line for each change made to it,
 * which the ops dashboard shows beside the comms entries. It reads the log scope the same way an
 * activity model reads its activity. Command only.
 */
import { compareShallow, computed, makeObservable } from 'mobx';
import type { WireMutation } from '@sync/core';
import type { SyncClient } from '@sync/client';
import { activityLogId, type LogEntryRec, type LogLevel } from '@sync/domain';
import { RecordStore } from '../store';

export class ActivityLog {
  readonly store = new RecordStore();
  readonly scopeId: string;
  private readonly lines = new Map<string, LogLine>();
  private readonly unsubscribe: () => void;

  /** The log scope must already be open on the client (`await client.open(activityLogId(activityId))`). */
  constructor(
    private readonly client: SyncClient,
    readonly activityId: string,
  ) {
    this.scopeId = activityLogId(activityId);
    makeObservable(this, { entries: computed({ equals: compareShallow }) });
    this.store.apply(client.snapshot(this.scopeId));
    this.unsubscribe = client.subscribe(this.scopeId, () => this.store.apply(client.snapshot(this.scopeId)));
  }

  dispose(): void {
    this.unsubscribe();
  }

  /** Every line, oldest first. */
  get entries(): LogLine[] {
    return [...this.store.scan<LogEntryRec>('logEntry')].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)).map((r) => this.line(r.id));
  }

  /** @internal */
  mutate(name: string, args: Record<string, unknown>): WireMutation {
    return this.client.mutate(this.scopeId, name, args);
  }

  private line(id: string): LogLine {
    let line = this.lines.get(id);
    if (!line) this.lines.set(id, (line = new LogLine(this, id)));
    return line;
  }
}

export class LogLine {
  constructor(
    readonly log: ActivityLog,
    readonly id: string,
  ) {
    makeObservable(this, { record: computed });
  }

  get record(): LogEntryRec | undefined {
    return this.log.store.get<LogEntryRec>('logEntry', this.id);
  }

  get at(): number {
    return this.record?.at ?? 0;
  }

  /** Who made the change. */
  get by(): string {
    return this.record?.by ?? '';
  }

  get text(): string {
    return this.record?.text ?? '';
  }

  /** 3 for team status and GAR changes, 4 for the rest. */
  get priority(): LogLevel {
    return this.record?.level ?? 4;
  }

  get favorite(): boolean {
    return this.record?.favorite ?? false;
  }

  setFavorite(favorite: boolean): WireMutation {
    return this.log.mutate('setLogFavorite', { id: this.id, favorite });
  }
}
