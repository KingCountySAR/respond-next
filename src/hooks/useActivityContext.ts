import { createContext, useContext } from 'react';

import { Activity } from '@respond/types/activity';

export const ActivityContext = createContext<Activity | null>(null);

export const useActivityContext = () => {
  const activityContext = useContext(ActivityContext);

  if (!activityContext) {
    throw new Error('useActivityContext has to be used within <ActivityContext.Provider>');
  }

  return activityContext;
};
