import { z } from 'zod';
import { Rejection, defineMutation } from '@sync/core';
import { DEFAULT_EARLY_SIGN_IN_WINDOW, currentParticipantStatus, getActivity, isActiveStatus } from '../queries';
import { DEFAULT_PLACES, ACTIVITY_KINDS, ACTIVITY_MODES, ACTIVITY_RECORD_ID, Location, type ParticipantRec } from '../schema';
import { asActivityViewer, isCommand, isMissionCommand } from '../viewer';
import { addStatus, at, id, idSource, requireActivity, requireOpen } from './common';

const ActivityFields = z.object({
  idNumber: z.string().trim(),
  kind: z.enum(ACTIVITY_KINDS),
  title: z.string().trim().min(1),
  description: z.string(),
  location: Location,
  mapId: z.string().trim(),
  startTime: z.number().finite(),
  earlySignInWindow: z.number().nonnegative().nullable(),
  ownerOrgId: id,
  mode: z.enum(ACTIVITY_MODES),
  standbyOnly: z.boolean(),
});

/** Starts an activity: the activity record plus the default places. */
export const createActivity = defineMutation({
  name: 'createActivity',
  version: 1,
  args: ActivityFields.extend({ earlySignInWindow: ActivityFields.shape.earlySignInWindow.default(DEFAULT_EARLY_SIGN_IN_WINDOW) }),
  // Command creates missions; members may create trainings and other events too.
  allow: (viewer) => isCommand(viewer) || asActivityViewer(viewer).class === 'member',
  describe: (a) => `Create ${a.title}`,
  run(tx, a, ctx) {
    if (a.kind === 'mission' && !isMissionCommand(ctx.viewer)) throw new Rejection('forbidden', 'Only command can create a mission');
    if (getActivity(tx)) throw new Rejection('exists', 'This event already exists');
    tx.put({ type: 'activity', id: ACTIVITY_RECORD_ID, ...a, endTime: null, closed: false, removedAt: null });
    const nextId = idSource(ctx);
    for (const name of Object.values(DEFAULT_PLACES)) tx.put({ type: 'place', id: nextId(), name, lat: null, lon: null, notes: null });
  },
});

export const updateActivity = defineMutation({
  name: 'updateActivity',
  version: 1,
  args: ActivityFields.partial(),
  allow: isCommand,
  describe: (_a, view) => `Edit ${getActivity(view)?.title ?? 'the event'}`,
  run(tx, a, ctx) {
    const activity = requireOpen(tx);
    if (a.kind === 'mission' && activity.kind !== 'mission' && !isMissionCommand(ctx.viewer)) throw new Rejection('forbidden', 'Only command can make this a mission');
    tx.update('activity', ACTIVITY_RECORD_ID, a);
  },
});

/** Ends the activity: everyone still active is cleared at `at`, and the activity becomes read-only. */
export const closeActivity = defineMutation({
  name: 'closeActivity',
  version: 1,
  timed: true,
  args: z.object({ at }),
  allow: isCommand,
  describe: (_a, view) => `Close ${getActivity(view)?.title ?? 'the event'}`,
  run(tx, a, ctx) {
    requireOpen(tx);
    const nextId = idSource(ctx);
    for (const p of [...tx.scan<ParticipantRec>('participant')]) {
      const current = currentParticipantStatus(tx, p.id, a.at);
      if (current && isActiveStatus(current.status)) addStatus(tx, ctx, nextId, p.id, current.unitId, 'clear', a.at, 'Activity closed');
    }
    tx.update('activity', ACTIVITY_RECORD_ID, { closed: true, endTime: a.at });
  },
});

export const reopenActivity = defineMutation({
  name: 'reopenActivity',
  version: 1,
  args: z.object({}),
  allow: isCommand,
  describe: (_a, view) => `Reopen ${getActivity(view)?.title ?? 'the event'}`,
  run(tx) {
    const activity = requireActivity(tx);
    if (!activity.closed) throw new Rejection('not_closed', 'This event is already open');
    tx.update('activity', ACTIVITY_RECORD_ID, { closed: false, endTime: null });
  },
});

/** Removes the activity from every list. Its records stay, so it can be restored by hand. */
export const removeActivity = defineMutation({
  name: 'removeActivity',
  version: 1,
  timed: true,
  args: z.object({ at }),
  allow: isCommand,
  describe: (_a, view) => `Remove ${getActivity(view)?.title ?? 'the event'}`,
  run(tx, a) {
    requireActivity(tx);
    tx.update('activity', ACTIVITY_RECORD_ID, { removedAt: a.at });
  },
});
