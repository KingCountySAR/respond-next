import { Activity } from '@respond/shared/types/activity';
import { createContext, useContext } from 'react';

const ActivityContext = createContext<Activity | null>(null);

export function ActivityProvider({ activity, children }: { activity?: Activity; children: React.ReactNode }) {
  return <ActivityContext.Provider value={activity ?? null}>{children}</ActivityContext.Provider>;
}

export const useActivityContext = () => {
  const activityContext = useContext(ActivityContext);

  if (!activityContext) {
    throw new Error('useActivityContext must be used within <ActivityProvider>');
  }

  return activityContext;
};
