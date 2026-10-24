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

/** A kind of change: `A` its parsed args, `N` its name, `I` the args callers pass (the schema's input). */
export interface MutationDef<A = any, N extends string = string, I = any> {
  name: N;
  version: number;
  args: ZodType<A, any, I>;
  /** Args carry `at` (when it happened). The client fills in its corrected clock when absent. */
  timed?: boolean;
  allow?(viewer: Viewer): boolean;
  /** Human-readable text for pending markers, rejection notices and reports. */
  describe(args: A, view: ReadView): string;
  /** Must be deterministic: time and new ids come only from `args` and `ctx`. */
  run(tx: Tx, args: A, ctx: MutationCtx): void;
}

/** Keeps the name as a literal type, so a set of mutations can be called by name with typed args. */
export const defineMutation = <const N extends string, A, I>(def: MutationDef<A, N, I>): MutationDef<A, N, I> => def;

/** The mutation named `N` in a set of them; any of them for a set whose names aren't known. */
export type MutationNamed<D extends MutationDef, N extends string> = string extends D['name'] ? D : Extract<D, { name: N }>;

/** What a caller passes: the args schema's input, with `at` optional (a timed change gets the client's clock). */
export type MutationInput<D extends MutationDef> = D extends MutationDef<any, any, infer I> ? ('at' extends keyof I ? Omit<I, 'at'> & { at?: number } : I) : never;

/** A call to one of a set's mutations, kept for later: its name and args, checked together. */
export type MutationCall<D extends MutationDef> = D extends MutationDef<any, infer N, any> ? { name: N; args: MutationInput<D> } : never;

export function mutationCtx(viewer: Viewer, clientId: string, mutationId: number, side: 'client' | 'server'): MutationCtx {
  return { viewer, clientId, mutationId, side, newId: (n = 0) => deriveId(`${clientId}:${mutationId}:${n}`) };
}

/** A set of mutations, `D` the union of their definitions (for typed calls; see `SyncClient.mutate`). */
export class MutationRegistry<D extends MutationDef = MutationDef> {
  private readonly defs = new Map<string, MutationDef>();
  private readonly latestByName = new Map<string, MutationDef>();

  constructor(defs: readonly D[]) {
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
