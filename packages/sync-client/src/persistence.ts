import { openDB, type IDBPDatabase } from 'idb';
import type { PersistedEvent } from '@sync/core';

export interface ClientMeta {
  clientId: string;
  nextMutationId: number;
}

export interface ClientPersistence {
  loadMeta(): Promise<ClientMeta | undefined>;
  saveMeta(meta: ClientMeta): Promise<void>;
  loadEvent(eventId: string): Promise<PersistedEvent | undefined>;
  saveEvent(eventId: string, data: PersistedEvent): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
}

/** Keeps nothing across page loads; for tests and throwaway dashboard clients. */
export class MemoryPersistence implements ClientPersistence {
  private meta: ClientMeta | undefined;
  private readonly events = new Map<string, PersistedEvent>();

  async loadMeta() {
    return this.meta;
  }
  async saveMeta(meta: ClientMeta) {
    this.meta = { ...meta };
  }
  async loadEvent(eventId: string) {
    return this.events.get(eventId);
  }
  async saveEvent(eventId: string, data: PersistedEvent) {
    this.events.set(eventId, data);
  }
  async deleteEvent(eventId: string) {
    this.events.delete(eventId);
  }
}

/** Survives reloads, so the UI renders at once and catches up from its last version. */
export class IndexedDbPersistence implements ClientPersistence {
  private readonly db: Promise<IDBPDatabase>;

  constructor(dbName = 'sync') {
    this.db = openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore('meta');
        db.createObjectStore('events');
      },
    });
  }

  async loadMeta() {
    return (await this.db).get('meta', 'client') as Promise<ClientMeta | undefined>;
  }
  async saveMeta(meta: ClientMeta) {
    await (await this.db).put('meta', meta, 'client');
  }
  async loadEvent(eventId: string) {
    return (await this.db).get('events', eventId) as Promise<PersistedEvent | undefined>;
  }
  async saveEvent(eventId: string, data: PersistedEvent) {
    await (await this.db).put('events', data, eventId);
  }
  async deleteEvent(eventId: string) {
    await (await this.db).delete('events', eventId);
  }
}
