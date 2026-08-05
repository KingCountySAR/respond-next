import { produce } from 'immer';

import { defaultEarlySigninWindow } from '../../types/activity';
import { Activity, createNewActivity } from '../../types/activity';
import { createNewLocation } from '../../types/location';

import { ActivityState } from '..';
import { ActivityActions } from '../activityActions';
import { BasicReducers } from '../activityReducers';

describe('Activity Reducers', () => {
  it('applies participant tags', () => {
    const activityId = '369a6656-19e5-4828-8b40-db325d78ca0a';
    const participantId = '12345';

    const activity: Activity = createNewActivity();
    activity.id = activityId;
    activity.forceStandbyOnly = false;
    activity.idNumber = '';
    activity.title = 'sample event';
    activity.description = '';
    activity.location = createNewLocation();
    activity.mapId = '';
    activity.startTime = 1699765740000;
    activity.earlySignInWindow = defaultEarlySigninWindow;
    activity.isMission = false;
    activity.asMission = false;
    activity.ownerOrgId = '1';
    activity.participants = {
      [participantId]: {
        id: participantId,
        firstname: 'Matt',
        lastname: 'Cosand',
        organizationId: '1',
        miles: 0,
        timeline: [{ time: 1699766001841, status: 3, organizationId: '1' }],
      },
    };
    activity.organizations = { '1': { timeline: [{ status: 4, time: 1699765795339 }], id: '1', title: 'King County Explorer Search and Rescue', rosterName: 'ESAR' } };

    const startState: ActivityState = {
      list: [activity],
    };

    const tags = ['Snow', 'OL', 'Rigger', 'RigLead'];
    const tagAction = ActivityActions.tagParticipant(activityId, participantId, tags);
    const newState = produce(startState, (draft) => BasicReducers[ActivityActions.tagParticipant.type](draft, tagAction));

    expect(newState.list[0].participants[participantId].tags).toEqual(tags);
  });

  it('supports updating activity type via ActivityActions.update', () => {
    const activityId = 'd5ce23b0-4a91-4f2d-ad34-b39166a1d5f4';
    const activity: Activity = createNewActivity();
    activity.id = activityId;
    activity.forceStandbyOnly = false;
    activity.idNumber = '';
    activity.title = 'sample event';
    activity.description = '';
    activity.location = createNewLocation();
    activity.mapId = '';
    activity.startTime = 1699765740000;
    activity.earlySignInWindow = defaultEarlySigninWindow;
    activity.isMission = false;
    activity.asMission = false;
    activity.ownerOrgId = '1';
    activity.participants = {};
    activity.organizations = {};

    const startState: ActivityState = {
      list: [activity],
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
