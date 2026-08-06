import { CommsCommands, LogCommInput } from '@respond/shared/commands';
import { PlaceEvents } from '@respond/shared/events';
import { isDefaultPlace, Place } from '@respond/shared/types/operations';

import { Reactor, ReactorContext } from './reactor';

function establishedEntry(place: Place): LogCommInput {
  const parts = [place.name, 'established:'];
  if (place.lat?.trim() && place.lon?.trim()) parts.push(`${place.lat.trim()}, ${place.lon.trim()}`);
  if (place.notes?.trim()) parts.push(place.notes.trim());
  return { from: place.name, to: 'CP', message: parts.join(' '), isAutomated: true };
}

function terminatedEntry(placeName: string): LogCommInput {
  return { from: placeName, to: 'CP', message: `${placeName} terminated`, isAutomated: true };
}

/**
 * Auto-logs the communications entries that used to be hand-dispatched from the
 * client (DashboardPlaceManager). Now the comm is server-authored and atomic
 * with the place change: a place event fires -> this reactor emits a LogComm
 * command -> the server mints the CommLogged event.
 */
export const placeCommsReactor: Reactor = {
  name: 'place-comms-reactor',

  react(event, ctx: ReactorContext) {
    if (PlaceEvents.PlaceCreated.match(event)) {
      // Default places (Command Post / Field) are created silently by the
      // bootstrap + team-disband reassign — they get no "established" comm.
      if (isDefaultPlace(event.payload.place)) return [];
      return [CommsCommands.LogComm(event.payload.activityId, establishedEntry(event.payload.place))];
    }

    if (PlaceEvents.PlaceDeleted.match(event)) {
      const place = ctx.priorActivities[event.payload.activityId]?.places?.find((p) => p.id === event.payload.placeId);
      return place ? [CommsCommands.LogComm(event.payload.activityId, terminatedEntry(place.name))] : [];
    }

    if (PlaceEvents.PlacesBatchChanged.match(event)) {
      const prior = ctx.priorActivities[event.payload.activityId];
      return event.payload.deleteIds.flatMap((id) => {
        const place = prior?.places?.find((p) => p.id === id);
        return place ? [CommsCommands.LogComm(event.payload.activityId, terminatedEntry(place.name))] : [];
      });
    }

    return [];
  },
};
