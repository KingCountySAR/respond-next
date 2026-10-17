/**
 * The activity list: one item per activity the server summarizes, for lists such as Home. It reads
 * the list scope (`ACTIVITY_LIST_ID`) the same way an activity model reads its activity.
 */
import { compareShallow, computed, makeObservable } from 'mobx';
import type { SyncClient } from '@sync/client';
import { ACTIVITY_LIST_ID, activityPhase, isActiveStatus, type ActivityPhase, type ActivitySummaryRec, type ParticipantStatus } from '@sync/domain';
import { Clock } from '../clock';
import { RecordStore } from '../store';

export class ActivityList {
  readonly store = new RecordStore();
  readonly clock: Clock;
  private readonly items = new Map<string, ActivityListItem>();
  private readonly unsubscribe: () => void;

  /** The list scope must already be open on the client (`await client.open(ACTIVITY_LIST_ID)`). */
  constructor(
    private readonly client: SyncClient,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? new Clock(() => client.now());
    makeObservable(this, { activities: computed({ equals: compareShallow }) });
    this.store.apply(client.snapshot(ACTIVITY_LIST_ID));
    this.unsubscribe = client.subscribe(ACTIVITY_LIST_ID, () => this.store.apply(client.snapshot(ACTIVITY_LIST_ID)));
  }

  dispose(): void {
    this.unsubscribe();
  }

  /** Every listed activity, in no particular order: each list sorts and filters for itself. */
  get activities(): ActivityListItem[] {
    return [...this.store.scan<ActivitySummaryRec>('activitySummary')].map((r) => this.item(r.id)!);
  }

  item(id: string): ActivityListItem | undefined {
    if (!this.store.get('activitySummary', id)) return undefined;
    let item = this.items.get(id);
    if (!item) this.items.set(id, (item = new ActivityListItem(this, id)));
    return item;
  }
}

export class ActivityListItem {
  constructor(
    readonly list: ActivityList,
    /** The activity's id. */
    readonly id: string,
  ) {
    makeObservable(this, { record: computed, phase: computed, activeParticipantCount: computed });
  }

  get record(): ActivitySummaryRec | undefined {
    return this.list.store.get<ActivitySummaryRec>('activitySummary', this.id);
  }

  get activity(): ActivitySummaryRec['activity'] | undefined {
    return this.record?.activity;
  }

  get isMission(): boolean {
    return this.activity?.kind === 'mission';
  }

  get phase(): ActivityPhase | undefined {
    const a = this.activity;
    return a && activityPhase(a, this.list.clock.now());
  }

  /** Not closed. */
  get isActive(): boolean {
    return !!this.activity && !this.activity.closed;
  }

  get startsInFuture(): boolean {
    const a = this.activity;
    return !!a && a.startTime > this.list.clock.now();
  }

  /** People active now, standby included. */
  get activeParticipantCount(): number {
    return Object.values(this.record?.people ?? {}).filter((p) => isActiveStatus(p.status)).length;
  }

  get units(): ActivitySummaryRec['units'] {
    return this.record?.units ?? [];
  }

  /** A participant's status here, by participant id (`participantIdFor(personRef)` for yourself). */
  statusOf(participantId: string): ParticipantStatus | undefined {
    return this.record?.people[participantId]?.status;
  }
}
