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
 * command pipeline, authored by the reactor as a service). `react` may be async
 * (e.g. the tagging reactor looks up member info).
 */
export interface Reactor {
  /** Stable id used as the service author of any follow-up commands. */
  readonly name: string;
  react(event: DomainEvent, ctx: ReactorContext): Command[] | Promise<Command[]>;
}
