import { ActivityEvents } from './activityEvents';
import type { EventMeta } from './author';
import { CommsEvents } from './commsEvents';
import { ParticipantEvents } from './participantEvents';
import { PlaceEvents } from './placeEvents';
import { TeamEvents } from './teamEvents';

export * from './author';
export { PlaceEvents } from './placeEvents';
export { CommsEvents } from './commsEvents';
export { ParticipantEvents } from './participantEvents';
export { TeamEvents } from './teamEvents';
export { ActivityEvents } from './activityEvents';

/** Event creators reduced into ActivityState. */
export const ActivityDomainEvents = {
  ...PlaceEvents,
  ...CommsEvents,
  ...ParticipantEvents,
  ...TeamEvents,
  ...ActivityEvents,
};

export type ActivityDomainEventsType = typeof ActivityDomainEvents;

/** All domain event creators, keyed by name. */
export const DomainEvents = {
  ...ActivityDomainEvents,
};

export type DomainEventsType = typeof DomainEvents;

type AllDomainEvents = {
  [K in keyof DomainEventsType]: ReturnType<DomainEventsType[K]>;
};

/** A bare domain event ({ type, payload }) before the server stamps meta. */
export type DomainEvent = AllDomainEvents[keyof DomainEventsType];

/** A domain event after the server stamps author + timestamp — what gets persisted + broadcast. */
export type StampedEvent = DomainEvent & {
  /** App-level unique id, minted when the server stamps the event. */
  id: string;
  meta: EventMeta;
};

export function isDomainEvent(object: { type: string }): object is DomainEvent {
  return Object.values(DomainEvents).some((e) => e.type === object.type);
}
