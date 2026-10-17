import { useCallback } from 'react';
import { Rejection } from '@sync/core';
import { useDialogs } from '../../shell/dialogs';

/**
 * Runs a change and shows the reason if it's refused. The client checks the same rules as the
 * server, so a refusal shows up here at once; one the server makes later arrives as a rejection.
 */
export function useChange(): (change: () => unknown) => boolean {
  const { alert } = useDialogs();
  return useCallback(
    (change) => {
      try {
        change();
        return true;
      } catch (err) {
        if (!(err instanceof Rejection)) throw err;
        void alert({ title: 'Not changed', message: err.message, type: 'error' });
        return false;
      }
    },
    [alert],
  );
}
