import { createContext, useContext } from 'react';

import { Participant } from '@respond/types/activity';

export const ParticipantContext = createContext<Participant | null>(null);

export const useParticipantContext = () => {
  const participantContext = useContext(ParticipantContext);

  if (!participantContext) {
    throw new Error('useParticipantContext has to be used within <ParticipantContext.Provider>');
  }

  return participantContext;
};
