import { produce } from 'immer';

import { LocationEvents } from '../../events/locationEvents';
import { createNewLocation } from '../../types/location';

import { LocationState } from '..';
import { BasicLocationEventReducers } from '../locationEventReducers';

function apply<E extends { type: string; payload: unknown }>(state: LocationState, event: E): LocationState {
  return produce(state, (draft) => BasicLocationEventReducers[event.type as keyof typeof BasicLocationEventReducers](draft, event as never));
}

describe('Location Event Reducers', () => {
  it('LocationUpdated upserts a location', () => {
    const loc = { ...createNewLocation(), id: 'L1', title: 'Trailhead' };
    let next = apply({ list: [] }, LocationEvents.LocationUpdated(loc));
    expect(next.list.map((l) => l.title)).toEqual(['Trailhead']);
    // update merges into the existing record
    next = apply(next, LocationEvents.LocationUpdated({ id: 'L1', title: 'Trailhead 2' }));
    expect(next.list).toHaveLength(1);
    expect(next.list[0].title).toBe('Trailhead 2');
  });

  it('LocationRemoved deletes by id', () => {
    const loc = { ...createNewLocation(), id: 'L1', title: 'Trailhead' };
    let next = apply({ list: [] }, LocationEvents.LocationUpdated(loc));
    next = apply(next, LocationEvents.LocationRemoved('L1'));
    expect(next.list).toEqual([]);
  });
});
