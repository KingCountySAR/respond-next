import type { Activity } from '@respond/types/activity';

const daysToMilliseconds = (days: number) => days * 24 * 60 * 60 * 1000;

import { filterInitialActivities, isActivityIncludedInInitialState } from '../activityVisibility';

function activity(id: string, startTime: number, endTime?: number): Activity {
  return {
    id,
    forceStandbyOnly: false,
    idNumber: '',
    title: id,
    description: '',
    location: undefined,
    mapId: '',
    startTime,
    endTime,
    isMission: true,
    asMission: false,
    ownerOrgId: 'org-1',
    participants: {},
    organizations: {},
  } as unknown as Activity;
}

describe('activity initial state visibility', () => {
  const now = new Date('2026-05-28T12:00:00Z').getTime();
  const historyMs = daysToMilliseconds(90);

  it('includes active activities even when they started before the history window', () => {
    expect(isActivityIncludedInInitialState(activity('active-old', now - daysToMilliseconds(180)), now, historyMs)).toBe(true);
  });

  it('includes future activities', () => {
    expect(isActivityIncludedInInitialState(activity('future', now + daysToMilliseconds(30), now - daysToMilliseconds(100)), now, historyMs)).toBe(true);
  });

  it('includes recently completed activities', () => {
    expect(isActivityIncludedInInitialState(activity('recent', now - daysToMilliseconds(10), now - daysToMilliseconds(5)), now, historyMs)).toBe(true);
  });

  it('excludes old completed activities', () => {
    expect(isActivityIncludedInInitialState(activity('old', now - daysToMilliseconds(120), now - daysToMilliseconds(100)), now, historyMs)).toBe(false);
  });

  it('filters a mixed list', () => {
    const visible = filterInitialActivities([activity('active-old', now - daysToMilliseconds(180)), activity('recent', now - daysToMilliseconds(10), now - daysToMilliseconds(5)), activity('old', now - daysToMilliseconds(120), now - daysToMilliseconds(100))], now, historyMs);

    expect(visible.map((a) => a.id)).toEqual(['active-old', 'recent']);
  });
});
