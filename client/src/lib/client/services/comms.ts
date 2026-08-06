import { CommsCommands, LogCommInput } from '@respond/shared/commands';
import { CommunicationsLogEntry } from '@respond/shared/types/operations';

import { useAppDispatch } from '../store';

/**
 * Comms service (Phase 2). Manual log entries go out as LogComm commands with no
 * id or timestamp — the server stamps those once when it mints the CommLogged
 * event, so the client never authors a comm id/clock. All automated comms
 * (place/team/role/status) are now emitted server-side by reactors.
 */
export function useCommsCommands() {
  const dispatch = useAppDispatch();

  return {
    logComm: (activityId: string, entry: LogCommInput) => dispatch(CommsCommands.LogComm(activityId, entry)),
    updateComm: (activityId: string, commId: string, updates: Partial<CommunicationsLogEntry>) => dispatch(CommsCommands.UpdateComm(activityId, commId, updates)),
  };
}
