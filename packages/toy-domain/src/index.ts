/**
 * Phase 1 stand-in domain: a roster of people with timed status entries and a command-only note.
 * Small on purpose; it exercises optimistic updates, rebasing, field-level projection and backdated
 * `at` times without the real mission model.
 */
import { z } from 'zod';
import { MutationRegistry, Rejection, defineMutation, type Projector, type ReadView, type Rec } from '@sync/core';

export const STATUSES = ['standby', 'responding', 'assigned', 'clear'] as const;
export type Status = (typeof STATUSES)[number];

export interface Person extends Rec {
  type: 'person';
  name: string;
  /** Command-only. */
  note?: string | null;
}

export interface PersonStatus extends Rec {
  type: 'personStatus';
  personId: string;
  status: Status;
  at: number;
  by: string;
}

const isCommand = (viewer: { tier: string }) => viewer.tier === 'command';
const nameOf = (view: ReadView, personId: string) => view.get<Person>('person', personId)?.name ?? 'someone';

export const addPerson = defineMutation({
  name: 'addPerson',
  version: 1,
  args: z.object({ id: z.string().min(1), name: z.string().trim().min(1) }),
  describe: (a) => `Add ${a.name}`,
  run(tx, a) {
    if (tx.get('person', a.id)) throw new Rejection('exists', `${a.name} was already added`);
    tx.put({ type: 'person', id: a.id, name: a.name, note: null });
  },
});

export const renamePerson = defineMutation({
  name: 'renamePerson',
  version: 1,
  args: z.object({ id: z.string().min(1), name: z.string().trim().min(1) }),
  describe: (a, view) => `Rename ${nameOf(view, a.id)} to ${a.name}`,
  run(tx, a) {
    tx.update('person', a.id, { name: a.name });
  },
});

export const setNote = defineMutation({
  name: 'setNote',
  version: 1,
  args: z.object({ id: z.string().min(1), note: z.string().nullable() }),
  allow: isCommand,
  describe: (a, view) => `Edit note for ${nameOf(view, a.id)}`,
  run(tx, a) {
    tx.update('person', a.id, { note: a.note });
  },
});

export const setStatus = defineMutation({
  name: 'setStatus',
  version: 1,
  timed: true,
  args: z.object({ personId: z.string().min(1), status: z.enum(STATUSES), at: z.number() }),
  describe: (a, view) => `Set ${nameOf(view, a.personId)} to ${a.status}`,
  run(tx, a, ctx) {
    if (!tx.get('person', a.personId)) throw new Rejection('not_found', 'That person was removed');
    tx.put({ type: 'personStatus', id: ctx.newId(), personId: a.personId, status: a.status, at: a.at, by: ctx.viewer.userId });
  },
});

export const removePerson = defineMutation({
  name: 'removePerson',
  version: 1,
  args: z.object({ id: z.string().min(1) }),
  allow: isCommand,
  describe: (a, view) => `Remove ${nameOf(view, a.id)}`,
  run(tx, a) {
    if (!tx.get('person', a.id)) throw new Rejection('not_found', 'That person was already removed');
    const statuses = [...tx.scan<PersonStatus>('personStatus')].filter((s) => s.personId === a.id);
    for (const s of statuses) tx.delete('personStatus', s.id);
    tx.delete('person', a.id);
  },
});

export const toyRegistry = new MutationRegistry([addPerson, renamePerson, setNote, setStatus, removePerson]);

export const toyProjector: Projector = {
  viewKey: (viewer) => (isCommand(viewer) ? 'command' : 'field'),
  project(viewKey, rec) {
    if (viewKey === 'field' && rec.type === 'person') {
      const { note: _note, ...rest } = rec;
      return rest as Rec;
    }
    return rec;
  },
};

/** Current status = the entry with the greatest `at`; ties broken by id so every client agrees. */
export function currentStatus(view: ReadView, personId: string): PersonStatus | undefined {
  let best: PersonStatus | undefined;
  for (const s of view.scan<PersonStatus>('personStatus')) {
    if (s.personId !== personId) continue;
    if (!best || s.at > best.at || (s.at === best.at && s.id > best.id)) best = s;
  }
  return best;
}
