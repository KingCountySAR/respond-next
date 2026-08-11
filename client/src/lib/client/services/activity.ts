import { ActivityCommands } from '@respond/shared/commands';
import { Activity, OrganizationStatus } from '@respond/shared/types/activity';

import { useAppDispatch } from '../store';

/**
 * Activity summary + lifecycle service (Phase 2). Components dispatch commands;
 * ClientSync forwards them and applies the events.
 */
export function useActivityCommands() {
  const dispatch = useAppDispatch();

  return {
    update: (updates: Partial<Activity> & { id: string }) => dispatch(ActivityCommands.UpdateActivity(updates)),
    remove: (activityId: string) => dispatch(ActivityCommands.RemoveActivity(activityId)),
    complete: (activityId: string, endTime: number) => dispatch(ActivityCommands.CompleteActivity(activityId, endTime)),
    reactivate: (activityId: string) => dispatch(ActivityCommands.ReactivateActivity(activityId)),
    appendOrganizationTimeline: (activityId: string, org: { id: string; title: string; rosterName?: string }, status: { time: number; status: OrganizationStatus }) =>
      dispatch(ActivityCommands.AppendOrganizationTimeline(activityId, org, status)),
  };
}
