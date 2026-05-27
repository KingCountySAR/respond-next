/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';

// Hook: when `open` is true, push a history state so browser Back will trigger `onClose`.
// When `open` becomes false the original history state is restored without firing popstate.
export default function useDialogHistory(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  const prevStateRef = useRef<any>(null);
  const idRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  const suppressPopRef = useRef(false);
  const popInitiatedRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePop = (ev: PopStateEvent) => {
      if (!pushedRef.current) return;
      const state = ev.state as any;
      // If this pop was triggered by our programmatic `history.back()`, just clean up.
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        pushedRef.current = false;
        idRef.current = null;
        prevStateRef.current = null;
        window.removeEventListener('popstate', handlePop);
        return;
      }

      // Close when the new state does NOT include our dialog id (i.e. user navigated back)
      if (!state || state.__respond_dialog_id !== idRef.current) {
        // Mark that the pop initiated the close so we don't try to pop again.
        popInitiatedRef.current = true;
        onCloseRef.current();
      }
    };

    if (open && !pushedRef.current) {
      try {
        prevStateRef.current = history.state;
        idRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        history.pushState({ ...(history.state || {}), __respond_dialog_id: idRef.current }, '');
        pushedRef.current = true;
        window.addEventListener('popstate', handlePop);
      } catch (e) {
        console.error('useDialogHistory pushState error:', e);
      }
    }

    if (!open && pushedRef.current) {
      try {
        // If the dialog was closed because the user clicked Back, the pop handler
        // already cleaned up. Avoid calling history.back() in that case.
        if (popInitiatedRef.current) {
          popInitiatedRef.current = false;
          pushedRef.current = false;
          idRef.current = null;
          prevStateRef.current = null;
          window.removeEventListener('popstate', handlePop);
        } else {
          // Programmatic close: go back to remove the pushed history entry.
          suppressPopRef.current = true;
          history.back();
        }
      } catch (e) {
        console.error('useDialogHistory cleanup error:', e);
      }
    }

    return () => {
      if (typeof window === 'undefined') return;
      window.removeEventListener('popstate', handlePop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
