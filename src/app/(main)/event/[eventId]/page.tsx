'use client';

import { EventPage } from '../../EventPage';

export default function ViewEvent({params}: { params: { eventId: string }}) {
  return (
    <EventPage eventId={params.eventId} />
  )
}