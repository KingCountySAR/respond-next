import { ParticipantCommands } from '@shared/commands';
import { ParticipantEvents } from '@shared/events';

import { Reactor, ReactorContext } from './reactor';

/** Resolves the org-specific tags for a participant (e.g. via the member provider). */
export type ResolveOrgTags = (organizationId: string, participantId: string) => Promise<string[]>;

/**
 * Replaces the old server-side `loadTagsIfNewParticipant` bolt-on. When a
 * participant is newly present in an activity (no tags yet), look up the org's
 * tags and emit a TagParticipant command (which becomes a ParticipantTagged
 * event). Emitting even an empty tag list marks the participant as resolved so
 * this doesn't fire again — until an org switch resets tags to undefined.
 *
 * The tag lookup is injected so the reactor stays pure/testable; production
 * wiring lives in reactors/index.ts.
 */
export function createParticipantTagReactor(resolveOrgTags: ResolveOrgTags): Reactor {
  return {
    name: 'participant-tag-reactor',

    async react(event, ctx: ReactorContext) {
      if (!ParticipantEvents.ParticipantUpdated.match(event)) return [];

      const { activityId } = event.payload;
      const participantId = event.payload.participant.id;
      const participant = ctx.currentActivities[activityId]?.participants[participantId];
      // Only newly-present (untagged) participants need tagging.
      if (!participant || participant.tags !== undefined) return [];

      const tags = await resolveOrgTags(participant.organizationId, participantId);
      return [ParticipantCommands.TagParticipant(activityId, participantId, tags)];
    },
  };
}
