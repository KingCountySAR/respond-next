import { openDB, type IDBPDatabase } from 'idb';
import type { PersistedActivity } from '@sync/core';

export interface ClientMeta {
  clientId: string;
  nextMutationId: number;
}

export interface ClientPersistence {
  loadMeta(): Promise<ClientMeta | undefined>;
  saveMeta(meta: ClientMeta): Promise<void>;
  loadActivity(activityId: string): Promise<PersistedActivity | undefined>;
  saveActivity(activityId: string, data: PersistedActivity): Promise<void>;
  deleteActivity(activityId: string): Promise<void>;
}

/** Keeps nothing across page loads; for tests and throwaway dashboard clients. */
export class MemoryPersistence implements ClientPersistence {
  private meta: ClientMeta | undefined;
  private readonly activities = new Map<string, PersistedActivity>();

  async loadMeta() {
    return this.meta;
  }
  async saveMeta(meta: ClientMeta) {
    this.meta = { ...meta };
  }
  async loadActivity(activityId: string) {
    return this.activities.get(activityId);
  }
  async saveActivity(activityId: string, data: PersistedActivity) {
    this.activities.set(activityId, data);
  }
  async deleteActivity(activityId: string) {
    this.activities.delete(activityId);
  }
}

/** Survives reloads, so the UI renders at once and catches up from its last version. */
export class IndexedDbPersistence implements ClientPersistence {
  private readonly db: Promise<IDBPDatabase>;

  constructor(dbName = 'sync') {
    this.db = openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore('meta');
        db.createObjectStore('activities');
      },
    });
  }

  async loadMeta() {
    return (await this.db).get('meta', 'client') as Promise<ClientMeta | undefined>;
  }
  async saveMeta(meta: ClientMeta) {
    await (await this.db).put('meta', meta, 'client');
  }
  async loadActivity(activityId: string) {
    return (await this.db).get('activities', activityId) as Promise<PersistedActivity | undefined>;
  }
  async saveActivity(activityId: string, data: PersistedActivity) {
    await (await this.db).put('activities', data, activityId);
  }
  async deleteActivity(activityId: string) {
    await (await this.db).delete('activities', activityId);
  }
}
