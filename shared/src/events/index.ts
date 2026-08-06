import { CommsEvents } from './commsEvents';
import { ParticipantEvents } from './participantEvents';
import { PlaceEvents } from './placeEvents';
import { TeamEvents } from './teamEvents';

import type { EventMeta } from './author';

export * from './author';
export { PlaceEvents } from './placeEvents';
export { CommsEvents } from './commsEvents';
export { ParticipantEvents } from './participantEvents';
export { TeamEvents } from './teamEvents';

/** All domain event creators, keyed by name. */
export const DomainEvents = {
  ...PlaceEvents,
  ...CommsEvents,
  ...ParticipantEvents,
  ...TeamEvents,
};

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
