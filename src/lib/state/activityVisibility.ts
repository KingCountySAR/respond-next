import type { Activity } from '@respond/types/activity';

/**
 * Filter activities by
 * * Active activities (no end time) are always included.
 * * Future activities (start time in the future) are always included.
 * * Completed activities are included only when their latest activity time is inside the retention window.
 *
 * This is used to determine which activities should be included in the initial state when the app loads, and also to 
 * filter activities before saving them to localStorage for caching purposes.
 */
export const INITIAL_ACTIVITY_HISTORY_DAYS = 90;
export const INITIAL_ACTIVITY_HISTORY_MS = INITIAL_ACTIVITY_HISTORY_DAYS * 24 * 60 * 60 * 1000;

export function isActivityIncludedInInitialState(activity: Activity, now = Date.now(), historyMs = INITIAL_ACTIVITY_HISTORY_MS) {
  // Active activities must remain in the initial cache even if they started long ago.
  if (!activity.endTime) return true;
  // Future activities must remain visible before they begin.
  if (activity.startTime > now) return true;

  // Completed activities are included only when their latest activity time is inside the retention window.
  const mostRecentActivityTime = Math.max(activity.startTime, activity.endTime);
  return mostRecentActivityTime >= now - historyMs;
}

export function filterInitialActivities(activities: Activity[], now = Date.now(), historyMs = INITIAL_ACTIVITY_HISTORY_MS) {
  return activities.filter((activity) => isActivityIncludedInInitialState(activity, now, historyMs));
}
