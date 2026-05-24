import produce from 'immer';

import { defaultEarlySigninWindow } from '@respond/lib/client/store/activities';
import { createNewLocation } from '@respond/types/location';

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
          forceStandbyOnly: false,
          idNumber: '',
          title: 'sample event',
          description: '',
          location: createNewLocation(),
          mapId: '',
          startTime: 1699765740000,
          earlySignInWindow: defaultEarlySigninWindow,
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

  it('supports updating activity type via ActivityActions.update', () => {
    const activityId = 'd5ce23b0-4a91-4f2d-ad34-b39166a1d5f4';
    const startState: ActivityState = {
      list: [
        {
          id: activityId,
          forceStandbyOnly: false,
          idNumber: '',
          title: 'sample event',
          description: '',
          location: createNewLocation(),
          mapId: '',
          startTime: 1699765740000,
          earlySignInWindow: defaultEarlySigninWindow,
          isMission: false,
          asMission: false,
          ownerOrgId: '1',
          participants: {},
          organizations: {},
        },
      ],
    };

    const updatedActivity = {
      ...startState.list[0],
      isMission: true,
      asMission: true,
    };

    const newState = produce(startState, (draft) => BasicReducers[ActivityActions.update.type](draft, ActivityActions.update(updatedActivity)));

    expect(newState.list[0].isMission).toBe(true);
    expect(newState.list[0].asMission).toBe(true);
  });
});
