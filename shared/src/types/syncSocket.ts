import type { StampedCommand } from '../commands';
import type { StampedEvent } from '../events';
import type { ActivityState, LocationState } from '../state';

import type UserAuth from './userAuth';

// Ephemeral "someone is here" signal, keyed by an arbitrary topic string (e.g.
// `activity:draft:events`, `participant:123:edit`) so any feature can reuse the
// same channel without inventing its own socket events.
export interface PresencePing<T = unknown> {
  topic: string;
  data: T;
}

export interface PresenceUpdate<T = unknown> extends PresencePing<T> {
  // The authenticated user id, not the socket id, so multiple tabs from the
  // same person collapse to one entry instead of counting as two editors.
  editorId: string;
  editorName: string;
  at: number;
}

// Sent once, in reply to `presenceSubscribe`: whatever the server currently
// knows about a topic, so a client that joins after others have already pinged
// isn't stuck waiting for their next ping to find out they're there.
export interface PresenceSnapshot {
  topic: string;
  entries: PresenceUpdate[];
}

export interface ServerToClientEvents {
  // Full-state snapshot pushed on connect: activities scoped to the user, plus
  // the locations catalog. Applied directly into the client read model.
  snapshot: (payload: { activities: ActivityState; locations: LocationState }) => void;
  // Command/event path: a batch of server-minted, authored facts from one
  // command (its own events plus any synchronous reactors'). Every connected
  // client (including the one that issued the command) applies them together, in
  // a single render. Always an array, even for a single event.
  events: (events: StampedEvent[]) => void;
  // Relayed directly (never persisted or replayed on reconnect): another org
  // member is actively working on something for this topic.
  presenceUpdate: (payload: PresenceUpdate) => void;
  // Reply to presenceSubscribe: current presence for the requested topic.
  presenceSnapshot: (payload: PresenceSnapshot) => void;
}

export interface ClientToServerEvents {
  // Command/event path: intent. The server authenticates the socket and pairs
  // the command with the session's author before producing events.
  command: (command: StampedCommand) => void;
  // Ephemeral presence signal for the given topic.
  presencePing: (payload: PresencePing) => void;
  // Ask the server for whoever is already present on a topic, so a newly
  // opened form learns about an already-active editor immediately.
  presenceSubscribe: (payload: { topic: string }) => void;
  logout: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  /** Set by the connection-auth middleware from the session cookie. */
  auth: UserAuth;
}
