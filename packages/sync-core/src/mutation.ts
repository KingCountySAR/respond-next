import type { ZodType } from 'zod';
import { deriveId } from './ids';
import type { ReadView, Tx } from './tx';

export interface Viewer {
  userId: string;
  tier: string;
}

export interface MutationCtx {
  viewer: Viewer;
  clientId: string;
  mutationId: number;
  side: 'client' | 'server';
  /** Deterministic id for the n-th record this mutation creates; identical on client and server. */
  newId(n?: number): string;
}

export interface MutationDef<A = any> {
  name: string;
  version: number;
  args: ZodType<A, any, any>;
  /** Args carry `at` (when it happened). The client fills in its corrected clock when absent. */
  timed?: boolean;
  allow?(viewer: Viewer): boolean;
  /** Human-readable text for pending markers, rejection notices and reports. */
  describe(args: A, view: ReadView): string;
  /** Must be deterministic: time and new ids come only from `args` and `ctx`. */
  run(tx: Tx, args: A, ctx: MutationCtx): void;
}

export const defineMutation = <A>(def: MutationDef<A>): MutationDef<A> => def;

export function mutationCtx(viewer: Viewer, clientId: string, mutationId: number, side: 'client' | 'server'): MutationCtx {
  return { viewer, clientId, mutationId, side, newId: (n = 0) => deriveId(`${clientId}:${mutationId}:${n}`) };
}

export class MutationRegistry {
  private readonly defs = new Map<string, MutationDef>();
  private readonly latestByName = new Map<string, MutationDef>();

  constructor(defs: MutationDef[]) {
    for (const def of defs) {
      this.defs.set(`${def.name}@${def.version}`, def);
      const latest = this.latestByName.get(def.name);
      if (!latest || latest.version < def.version) this.latestByName.set(def.name, def);
    }
  }

  get(name: string, version: number): MutationDef | undefined {
    return this.defs.get(`${name}@${version}`);
  }

  latest(name: string): MutationDef | undefined {
    return this.latestByName.get(name);
  }
}
