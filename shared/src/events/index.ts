import { ActivityEvents } from './activityEvents';
import type { EventMeta } from './author';
import { CommsEvents } from './commsEvents';
import { LocationEvents } from './locationEvents';
import { ParticipantEvents } from './participantEvents';
import { PlaceEvents } from './placeEvents';
import { TeamEvents } from './teamEvents';

export * from './author';
export { PlaceEvents } from './placeEvents';
export { CommsEvents } from './commsEvents';
export { ParticipantEvents } from './participantEvents';
export { TeamEvents } from './teamEvents';
export { LocationEvents } from './locationEvents';
export { ActivityEvents } from './activityEvents';

/** Event creators reduced into ActivityState (everything except Locations). */
export const ActivityDomainEvents = {
  ...PlaceEvents,
  ...CommsEvents,
  ...ParticipantEvents,
  ...TeamEvents,
  ...ActivityEvents,
};

export type ActivityDomainEventsType = typeof ActivityDomainEvents;

/** All domain event creators, keyed by name (activity + location). */
export const DomainEvents = {
  ...ActivityDomainEvents,
  ...LocationEvents,
};

/** True for events reduced into the Locations slice (not ActivityState). */
export function isLocationEvent(object: { type: string }): boolean {
  return Object.values(LocationEvents).some((e) => e.type === object.type);
}

export type DomainEventsType = typeof DomainEvents;

type AllDomainEvents = {
  [K in keyof DomainEventsType]: ReturnType<DomainEventsType[K]>;
};

/** A bare domain event ({ type, payload }) before the server stamps meta. */
export type DomainEvent = AllDomainEvents[keyof DomainEventsType];

/** A domain event after the server stamps author + timestamp — what gets persisted + broadcast. */
export type StampedEvent = DomainEvent & { meta: EventMeta };

export function isDomainEvent(object: { type: string }): object is DomainEvent {
  return Object.values(DomainEvents).some((e) => e.type === object.type);
}
