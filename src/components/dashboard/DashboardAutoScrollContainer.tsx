import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, Fab, SxProps, Theme } from '@mui/material';
import { ReactNode, useEffect, useRef, useState } from 'react';

const DEFAULT_SCROLL_BOTTOM_THRESHOLD = 16;
const PROGRAMMATIC_SCROLL_TIMEOUT_MS = 500;

type DashboardAutoScrollContainerProps<T> = {
  items: T[];
  getItemKey: (item: T) => string;
  /** Suspend auto-scrolling to new items without affecting the current scroll position, e.g. while a form is open. */
  paused?: boolean;
  scrollBottomThreshold?: number;
  children: ReactNode;
  sx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
};

/**
 * Scrollable container that stays pinned to the bottom as new items arrive, auto-scrolling to the
 * bottom on mount and whenever new items are appended. Auto-scroll is disabled when the user scrolls
 * away from the bottom, and a floating button appears to jump back down and re-enable it.
 */
export function DashboardAutoScrollContainer<T>({ items, getItemKey, paused = false, scrollBottomThreshold = DEFAULT_SCROLL_BOTTOM_THRESHOLD, children, sx, contentSx }: DashboardAutoScrollContainerProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousItemKeysRef = useRef<string[] | null>(null);
  const pendingNewItemScrollRef = useRef(false);
  const hasInitializedScrollRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [autoScroll, setAutoScroll] = useState(true);

  function beginProgrammaticScroll() {
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
    }
    // Fallback in case the animation never reports a scroll event that lands exactly at the bottom.
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, PROGRAMMATIC_SCROLL_TIMEOUT_MS);
  }

  useEffect(() => {
    const currentItemKeys = items.map(getItemKey);
    const previousItemKeys = previousItemKeysRef.current;
    previousItemKeysRef.current = currentItemKeys;

    const target = scrollContainerRef.current;

    if (!hasInitializedScrollRef.current) {
      // Wait until the list has actually laid out (non-zero height) before snapping to bottom.
      if (target && currentItemKeys.length > 0 && target.clientHeight > 0) {
        beginProgrammaticScroll();
        requestAnimationFrame(() => {
          if (target) {
            target.scrollTop = target.scrollHeight;
          }
          setAutoScroll(true);
        });
        hasInitializedScrollRef.current = true;
      }
      return;
    }

    if (!previousItemKeys) {
      return;
    }

    const hasNewItem = currentItemKeys.some((key) => previousItemKeys.indexOf(key) === -1);
    if (hasNewItem) {
      pendingNewItemScrollRef.current = autoScroll;
    }

    if (!autoScroll || paused || !pendingNewItemScrollRef.current) {
      return;
    }

    if (target) {
      beginProgrammaticScroll();
      target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
      pendingNewItemScrollRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, autoScroll, paused]);

  const handleScroll = () => {
    const target = scrollContainerRef.current;
    if (!target) {
      return;
    }
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const atBottom = distanceFromBottom <= scrollBottomThreshold;

    if (isProgrammaticScrollRef.current) {
      // Ignore intermediate scroll events from an in-flight auto-scroll to avoid flickering the button.
      if (atBottom) {
        isProgrammaticScrollRef.current = false;
        if (programmaticScrollTimeoutRef.current) {
          clearTimeout(programmaticScrollTimeoutRef.current);
          programmaticScrollTimeoutRef.current = null;
        }
      }
      return;
    }

    setAutoScroll(atBottom);
  };

  const scrollToBottom = () => {
    const target = scrollContainerRef.current;
    if (target) {
      beginProgrammaticScroll();
      target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
    }
    setAutoScroll(true);
  };

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', ...sx }}>
      <Box ref={scrollContainerRef} onScroll={handleScroll} sx={{ height: '100%', overflow: 'auto', width: '100%', ...contentSx }}>
        {children}
      </Box>
      {!autoScroll && (
        <Fab size="small" color="primary" onClick={scrollToBottom} aria-label="scroll to newest" sx={{ position: 'absolute', bottom: 8, right: 8 }}>
          <KeyboardArrowDownIcon />
        </Fab>
      )}
    </Box>
  );
}
