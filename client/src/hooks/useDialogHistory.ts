/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';

// Hook: when `open` is true, push a history state so browser Back will trigger `onClose`.
// When `open` becomes false the pushed history entry is removed without firing popstate.
export default function useDialogHistory(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  const idRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  const suppressPopRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Register a single popstate listener on mount. It consults refs to decide actions.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePop = (ev: PopStateEvent) => {
      if (!pushedRef.current) return;

      if (suppressPopRef.current) {
        // This pop was triggered by our programmatic history.back(); just clear flags.
        suppressPopRef.current = false;
        pushedRef.current = false;
        idRef.current = null;
        return;
      }

      const state = ev.state as any;
      // If the new state doesn't include our dialog id, treat it as user Back.
      if (!state || state.__respond_dialog_id !== idRef.current) {
        pushedRef.current = false;
        idRef.current = null;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Push state when opened; on close, remove pushed entry via history.back().
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (open && !pushedRef.current) {
      try {
        idRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        history.pushState({ ...(history.state || {}), __respond_dialog_id: idRef.current }, '');
        pushedRef.current = true;
      } catch (e) {
        console.error('useDialogHistory pushState error:', e);
      }
    } else if (!open && pushedRef.current) {
      try {
        // Programmatic close: suppress the resulting popstate and go back.
        suppressPopRef.current = true;
        history.back();
      } catch (e) {
        console.error('useDialogHistory cleanup error:', e);
      }
    }
  }, [open]);
}
