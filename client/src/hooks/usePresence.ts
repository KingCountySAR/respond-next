import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { presencePingSent, presenceSubscribeRequested } from '@respond/lib/client/store/presence';
import type { PresenceUpdate } from '@respond/shared/types/syncSocket';

import { useDebouncedCallback } from './useDebouncedCallback';

const DEFAULT_DEBOUNCE_MS = 3_000;
const DEFAULT_WINDOW_MS = 30_000;

/**
 * Publishes a debounced "I'm actively working on this" ping (via the socket,
 * never persisted) whenever `data` is non-null, and reports every other
 * editor currently active on the same topic — each dropped once its last
 * ping is older than `windowMs` (no heartbeat: presence expires purely from
 * inactivity). On mount, also asks the server for anyone already active, so
 * an editor who was present before this component mounted isn't missed.
 * Callers pass a topic string unique to the thing being edited (e.g.
 * `activity:draft:events`, `participant:123:edit`).
 */
export function usePresence<T>(topic: string, data: T | null, options?: { debounceMs?: number; windowMs?: number }) {
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;

  const dispatch = useAppDispatch();
  const mySocketId = useAppSelector((state) => state.sync.id);
  const byEditor = useAppSelector((state) => state.presence.byTopic[topic]) as Record<string, PresenceUpdate<T>> | undefined;

  useEffect(() => {
    dispatch(presenceSubscribeRequested({ topic }));
  }, [topic, dispatch]);

  const sendPing = useDebouncedCallback((pingData: T) => {
    dispatch(presencePingSent({ topic, data: pingData }));
  }, debounceMs);

  // Compare serialized content rather than object identity: callers like
  // react-hook-form's watch() return a new object on every render, and the
  // freshness timer below also re-renders periodically. Without this guard,
  // each of those renders would look like a fresh edit and re-arm the ping,
  // so two mutually-visible editors would keep each other's presence alive
  // forever instead of expiring after windowMs of real inactivity.
  const lastSentRef = useRef<string>();
  useEffect(() => {
    if (data === null) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastSentRef.current) return;
    lastSentRef.current = serialized;
    sendPing(data);
  }, [data, sendPing]);

  // Re-render periodically so an editor with no ping in the last windowMs drops out without requiring user interaction.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!byEditor || Object.keys(byEditor).length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [byEditor]);

  const others = useMemo(() => Object.values(byEditor ?? {}).filter((update) => update.editorId !== mySocketId && now - update.at < windowMs), [byEditor, now, windowMs, mySocketId]);

  return { others };
}
