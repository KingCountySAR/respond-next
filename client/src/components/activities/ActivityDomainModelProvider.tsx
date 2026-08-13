import { createContext, ReactNode, useContext, useEffect, useRef } from 'react';
import { useStore } from 'react-redux';

import type { AppStore } from '@respond/lib/client/store';

import { ActivityDomainModel } from 'src/models/activityDomainModel';

import { useClock } from '../AppDomainProvider';

import { useActivityContext } from './ActivityProvider';

const ActivityDomainModelContext = createContext<ActivityDomainModel | null>(null);

/**
 * Provides the Redux→observable domain model for an activity, independent of any
 * one view model. Multiple view models (the activity page, RosterView, …) can be
 * layered over the same domain model — so this owns only the model's lifecycle
 * (create per id, connect/dispose the store subscription, seed the read-only
 * fallback), not any view concern.
 *
 * Must be rendered inside an <ActivityProvider>.
 */
export function ActivityDomainModelProvider({ children }: { children: ReactNode }) {
  const activity = useActivityContext();
  const store = useStore() as AppStore;
  const clock = useClock();
  const activityId = activity.id;

  // One model per activity id. Built during render (pure) so consumers can build
  // their view models on first paint; the store subscription is owned by the
  // effect below so only the committed instance connects (StrictMode-safe).
  const ref = useRef<{ id: string; model: ActivityDomainModel } | null>(null);
  if (ref.current?.id !== activityId) {
    ref.current = { id: activityId, model: new ActivityDomainModel(store, activityId, clock) };
  }

  useEffect(() => {
    const model = ref.current?.model;
    model?.connect();
    return () => model?.dispose();
  }, [activityId]);

  // Feed the fetched fallback (for activities not in the store) into the model.
  useEffect(() => {
    ref.current?.model.setFallback(activity);
  }, [activity]);

  return <ActivityDomainModelContext.Provider value={ref.current.model}>{children}</ActivityDomainModelContext.Provider>;
}

export const useActivityDomainModel = () => {
  const model = useContext(ActivityDomainModelContext);

  if (!model) {
    throw new Error('useActivityDomainModel must be used within <ActivityDomainModelProvider>');
  }

  return model;
};
