import { createContext, useContext } from 'react';

import { Participant } from '@respond/types/activity';

const ParticipantContext = createContext<Participant | null>(null);

export function ParticipantProvider({ participant, children }: { participant?: Participant; children: React.ReactNode }) {
  return <ParticipantContext.Provider value={participant ?? null}>{children}</ParticipantContext.Provider>;
}

export const useParticipantContext = () => {
  const participantContext = useContext(ParticipantContext);

  if (!participantContext) {
    throw new Error('useParticipantContext has to be used within <ParticipantProvider>');
  }

  return participantContext;
};
