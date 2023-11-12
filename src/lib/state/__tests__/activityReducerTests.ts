import produce from 'immer';

import { ActivityState } from '..';
import { ActivityActions } from '../activityActions';
import { BasicReducers } from '../activityReducers';

describe('Activity Reducers', () => {
  it('applies participant tags', () => {
    const activityId = '369a6656-19e5-4828-8b40-db325d78ca0a';
    const participantId = '12345';

    const startState: ActivityState = {
      list: [
        {
          id: activityId,
          idNumber: '',
          title: 'sample event',
          description: '',
          location: { title: 'home' },
          mapId: '',
          startTime: 1699765740000,
          isMission: false,
          asMission: false,
          ownerOrgId: '1',
          participants: {
            [participantId]: {
              id: participantId,
              firstname: 'Matt',
              lastname: 'Cosand',
              organizationId: '1',
              miles: 0,
              timeline: [{ time: 1699766001841, status: 3, organizationId: '1' }],
            },
          },
          organizations: { '1': { timeline: [{ status: 4, time: 1699765795339 }], id: '1', title: 'King County Explorer Search and Rescue', rosterName: 'ESAR' } },
        },
      ],
    };

    const tags = ['Snow', 'OL', 'Rigger', 'RigLead'];
    const tagAction = ActivityActions.tagParticipant(activityId, participantId, tags);
    const newState = produce(startState, (draft) => BasicReducers[ActivityActions.tagParticipant.type](draft, tagAction));

    expect(newState.list[0].participants[participantId].tags).toEqual(tags);
  });
});
