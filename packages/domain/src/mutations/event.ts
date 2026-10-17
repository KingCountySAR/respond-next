import { z } from 'zod';
import { Rejection, defineMutation } from '@sync/core';
import { DEFAULT_EARLY_SIGN_IN_WINDOW, currentParticipantStatus, getEvent, isActiveStatus } from '../queries';
import { DEFAULT_PLACES, EVENT_KINDS, EVENT_MODES, EVENT_RECORD_ID, Location, type ParticipantRec } from '../schema';
import { isCommand } from '../viewer';
import { addStatus, at, id, idSource, requireEvent, requireOpen } from './common';

const EventFields = z.object({
  idNumber: z.string().trim(),
  kind: z.enum(EVENT_KINDS),
  title: z.string().trim().min(1),
  description: z.string(),
  location: Location,
  mapId: z.string().trim(),
  startTime: z.number().finite(),
  earlySignInWindow: z.number().nonnegative().nullable(),
  ownerOrgId: id,
  mode: z.enum(EVENT_MODES),
  standbyOnly: z.boolean(),
});

/** Starts an event: the event record plus the default places. */
export const createEvent = defineMutation({
  name: 'createEvent',
  version: 1,
  args: EventFields.extend({ earlySignInWindow: EventFields.shape.earlySignInWindow.default(DEFAULT_EARLY_SIGN_IN_WINDOW) }),
  allow: isCommand,
  describe: (a) => `Create ${a.title}`,
  run(tx, a, ctx) {
    if (getEvent(tx)) throw new Rejection('exists', 'This event already exists');
    tx.put({ type: 'event', id: EVENT_RECORD_ID, ...a, endTime: null, closed: false, removedAt: null });
    const nextId = idSource(ctx);
    for (const name of Object.values(DEFAULT_PLACES)) tx.put({ type: 'place', id: nextId(), name, lat: null, lon: null, notes: null });
  },
});

export const updateEvent = defineMutation({
  name: 'updateEvent',
  version: 1,
  args: EventFields.partial(),
  allow: isCommand,
  describe: (_a, view) => `Edit ${getEvent(view)?.title ?? 'the event'}`,
  run(tx, a) {
    requireOpen(tx);
    tx.update('event', EVENT_RECORD_ID, a);
  },
});

/** Ends the event: everyone still active is cleared at `at`, and the event becomes read-only. */
export const closeEvent = defineMutation({
  name: 'closeEvent',
  version: 1,
  timed: true,
  args: z.object({ at }),
  allow: isCommand,
  describe: (_a, view) => `Close ${getEvent(view)?.title ?? 'the event'}`,
  run(tx, a, ctx) {
    requireOpen(tx);
    const nextId = idSource(ctx);
    for (const p of [...tx.scan<ParticipantRec>('participant')]) {
      const current = currentParticipantStatus(tx, p.id, a.at);
      if (current && isActiveStatus(current.status)) addStatus(tx, ctx, nextId, p.id, current.unitId, 'clear', a.at);
    }
    tx.update('event', EVENT_RECORD_ID, { closed: true, endTime: a.at });
  },
});

export const reopenEvent = defineMutation({
  name: 'reopenEvent',
  version: 1,
  args: z.object({}),
  allow: isCommand,
  describe: (_a, view) => `Reopen ${getEvent(view)?.title ?? 'the event'}`,
  run(tx) {
    const event = requireEvent(tx);
    if (!event.closed) throw new Rejection('not_closed', 'This event is already open');
    tx.update('event', EVENT_RECORD_ID, { closed: false, endTime: null });
  },
});

/** Removes the event from every list. Its records stay, so it can be restored by hand. */
export const removeEvent = defineMutation({
  name: 'removeEvent',
  version: 1,
  timed: true,
  args: z.object({ at }),
  allow: isCommand,
  describe: (_a, view) => `Remove ${getEvent(view)?.title ?? 'the event'}`,
  run(tx, a) {
    requireEvent(tx);
    tx.update('event', EVENT_RECORD_ID, { removedAt: a.at });
  },
});
