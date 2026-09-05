import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a stable, debounced wrapper around `fn`: each call resets a timer and
 * only the last call within `delay` ms actually runs. Always invokes the latest
 * `fn` closure, and cancels any pending call on unmount. Unlike debouncing a
 * value, this never fires on mount — only in response to an actual invocation.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(
    (...args: A) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );
}
