import { Command } from '@respond/shared/commands';
import { DomainEvent } from '@respond/shared/events';
import { Activity } from '@respond/shared/types/activity';

/** Read-only context handed to reactors when an event fires. */
export interface ReactorContext {
  /**
   * The activities snapshot from *before* the triggering command's events were
   * applied. Lets a reactor resolve details of things the event removed (e.g.
   * the name of a just-deleted place) without denormalizing them into events.
   */
  priorActivities: Record<string, Activity>;
}

/**
 * A reactor is the single home for "when X happens, also do Y." It observes
 * server-minted events and may emit follow-up commands (which re-enter the
 * command pipeline, authored by the reactor as a service).
 */
export interface Reactor {
  /** Stable id used as the service author of any follow-up commands. */
  readonly name: string;
  react(event: DomainEvent, ctx: ReactorContext): Command[];
}
