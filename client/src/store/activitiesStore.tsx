import { Activity, ParticipantStatus, ParticipantUpdate } from '@app/shared/api';
import { computed, makeObservable, observable } from 'mobx';
import { createContext, useContext } from 'react';

export class ActivitiesStore {
  @observable accessor activeActivities: Activity[] = [];

  constructor(
    private readonly memberId: string|undefined
  ) {
    makeObservable(this);
  }

  @computed
  get myCurrentActivities() {
    const participantId = this.memberId;
    if (!participantId) {
      return [];
    }

    const myParticipation: { activity: Activity; status: ParticipantUpdate }[] = [];
    for (const activity of this.activeActivities) {
      const myUpdate = activity.participants[participantId]?.timeline[0];
      if (myUpdate && myUpdate.status !== ParticipantStatus.NotResponding) {
        myParticipation.push({ activity, status: myUpdate });
      }
    }

    return myParticipation.sort((a, b) => {
      if (a.activity.isMission === b.activity.isMission) {
        return a.activity.startTime > b.activity.startTime ? 1 : -1;
      }
      return a.activity.isMission ? 1 : -1;
    });
  }
}


const ActivitiesContextInstance = createContext<ActivitiesStore | null>(null);

export const ActivitiesProvider = ({ store, children }: { store: ActivitiesStore; children: React.ReactNode }) => (
  <ActivitiesContextInstance.Provider value={store}>{children}</ActivitiesContextInstance.Provider>
);

export const useActivitiesContext = () => {
  const ActivitiesContext = useContext(ActivitiesContextInstance);

  if (!ActivitiesContext) {
    throw new Error('useActivitiesContext must be used within <ActivitiesProvider>');
  }

  return ActivitiesContext;
};
