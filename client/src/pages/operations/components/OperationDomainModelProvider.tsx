import { createContext, ReactNode, useContext, useEffect, useRef } from 'react';
import { useStore } from 'react-redux';

import type { AppStore } from '@respond/lib/client/store';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import { useClock } from '@/client/components/AppDomainProvider';
import { OperationDomainModel } from '@/client/models/operationDomainModel';

const OperationDomainModelContext = createContext<OperationDomainModel | null>(null);

/**
 * The operations Dashboard's domain model, shared with every subcomponent. One
 * model per activity id, built during render (pure) so children can read it on
 * first paint; the store subscription is owned by the effect below so only the
 * committed instance connects (StrictMode-safe). Mirrors ActivityDomainModelProvider,
 * but vends an {@link OperationDomainModel} (teams/places/logs + activity facts).
 */
export function OperationDomainModelProvider({ children }: { children: ReactNode }) {
  const activity = useActivityContext();
  const store = useStore() as AppStore;
  const clock = useClock();
  const activityId = activity.id;

  const ref = useRef<{ id: string; model: OperationDomainModel } | null>(null);
  if (ref.current?.id !== activityId) {
    ref.current = { id: activityId, model: OperationDomainModel.forStore(store, activityId, clock) };
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

  return <OperationDomainModelContext.Provider value={ref.current.model}>{children}</OperationDomainModelContext.Provider>;
}

export const useOperationDomainModel = () => {
  const model = useContext(OperationDomainModelContext);
  if (!model) {
    throw new Error('useOperationDomainModel must be used within the operations Dashboard');
  }
  return model;
};
