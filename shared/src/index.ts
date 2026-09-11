import type { Draft } from '@reduxjs/toolkit';

import { DomainEvents } from './events';
import { Activity } from './types/activity';
import { Organization } from './types/organization';

// @respond/shared — domain + state core shared by client and server.

export interface ActivityState {
  list: Activity[];
}

export interface OrganizationState {
  list: Organization[];
}

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

type EventReducer = (state: Draft<ActivityState>, payload: never) => void;

/**
 * Pure event-appliers keyed by event type, built from each event's own
 * `reduce` (colocated with its type/payload in shared/src/events/*.ts). Has
 * no server-specific dependencies (no Mongo), so it's safe to import from a
 * fast, dependency-free test as well as from server/src/stateManager.ts.
 */
export const eventReducersByType: Record<string, EventReducer> = Object.fromEntries(Object.values(DomainEvents).map((e) => [e.type, e.reduce as never]));
