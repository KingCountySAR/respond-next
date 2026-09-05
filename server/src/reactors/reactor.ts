import { Command } from '@shared/commands';
import { DomainEvent } from '@shared/events';
import { Activity } from '@shared/types/activity';

/** Read-only context handed to reactors when an event fires. */
export interface ReactorContext {
  /**
   * The activities snapshot from *before* the triggering command's events were
   * applied. Lets a reactor resolve details of things the event removed (e.g.
   * the name of a just-deleted place) without denormalizing them into events.
   */
  priorActivities: Record<string, Activity>;
  /**
   * The activities snapshot *after* the events were applied — the current state.
   * Lets a reactor inspect the result (e.g. whether a just-updated participant
   * still has no tags).
   */
  currentActivities: Record<string, Activity>;
}

/**
 * A reactor is the single home for "when X happens, also do Y." It observes
 * server-minted events and may emit follow-up commands (which re-enter the
 * command pipeline, authored by the reactor as a service).
 *
 * Sync vs async is inferred from the return type of `react`:
 *  - Returning `Command[]` (synchronous) folds the follow-up events into the
 *    *same* atomic batch as the triggering command — one Mongo write, one
 *    broadcast, one client render. Use this for immediate business rules (e.g.
 *    auto-logging a comms entry alongside a place/team change).
 *  - Returning `Promise<Command[]>` runs the reactor fire-and-forget *after* the
 *    batch commits; its follow-up commands re-enter the pipeline as their own
 *    later broadcast. Use this for slow work (e.g. the tagging reactor's
 *    member-provider lookup) that must not block or delay the batch.
 */
export interface Reactor {
  /** Stable id used as the service author of any follow-up commands. */
  readonly name: string;
  react(event: DomainEvent, ctx: ReactorContext): Command[] | Promise<Command[]>;
}
