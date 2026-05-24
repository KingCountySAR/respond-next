/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';

// Hook: when `open` is true, push a history state so browser Back will trigger `onClose`.
// When `open` becomes false the original history state is restored without firing popstate.
export default function useDialogHistory(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  const prevStateRef = useRef<any>(null);
  const idRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePop = (ev: PopStateEvent) => {
      if (!pushedRef.current) return;
      // Close when the new state does NOT include our dialog id (i.e. user navigated back)
      const state = ev.state as any;
      if (!state || state.__respond_dialog_id !== idRef.current) {
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
        // Restore previous state without firing popstate
        history.replaceState(prevStateRef.current, '');
      } catch (e) {
        console.error('useDialogHistory replaceState error:', e);
      }
      pushedRef.current = false;
      idRef.current = null;
      prevStateRef.current = null;
      window.removeEventListener('popstate', handlePop);
    }

    return () => {
      if (typeof window === 'undefined') return;
      window.removeEventListener('popstate', handlePop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
