import { ParticipantCommands } from '@shared/commands';
import { TeamEvents } from '@shared/events';
import { ParticipantStatus } from '@shared/types/activity';

import { Reactor, ReactorContext } from './reactor';

/**
 * Keeps a responder's status in step with their assignment. When a member is
 * moved (TeamMemberAssigned), flip them between the two "checked-in" statuses:
 * putting an Available responder on a team *or* a place makes them Assigned;
 * taking an Assigned responder off every team and place makes them Available.
 *
 * Synchronous, so the status change folds into the same broadcast as the
 * assignment (no flicker). Only ever flips between Available and Assigned — it
 * never overrides other statuses (SignedIn, Standby, SignedOut, …), and a move
 * between assignments leaves an already-Assigned member untouched.
 */
export const teamAssignmentReactor: Reactor = {
  name: 'team-assignment-reactor',

  react(event, ctx: ReactorContext) {
    if (!TeamEvents.TeamMemberAssigned.match(event)) return [];

    const { activityId, participantId } = event.payload;
    const activity = ctx.currentActivities[activityId];
    const participant = activity?.participants[participantId];
    if (!participant) return [];

    const onTeam = (activity.teams ?? []).some((team) => team.assignedParticipants.includes(participantId));
    const onPlace = (activity.places ?? []).some((place) => place.assignedParticipants.includes(participantId));
    const isAssigned = onTeam || onPlace;
    const currentStatus = participant.timeline[0]?.status;

    let nextStatus: ParticipantStatus | undefined;
    if (isAssigned && currentStatus === ParticipantStatus.Available) nextStatus = ParticipantStatus.Assigned;
    else if (!isAssigned && currentStatus === ParticipantStatus.Assigned) nextStatus = ParticipantStatus.Available;

    if (nextStatus === undefined) return [];
    return [
      ParticipantCommands.AddParticipantTimeline(activityId, participantId, {
        time: Date.now(),
        organizationId: participant.timeline[0].organizationId,
        status: nextStatus,
      }),
    ];
  },
};
