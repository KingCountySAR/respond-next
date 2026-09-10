import { useMemo } from 'react';

import { useAppDispatch } from '../../lib/client/store';

type AnyCommandCreator = (...args: never[]) => { type: string; payload: unknown };
type DropFirst<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : T;

function lowerFirst<S extends string>(s: S): Uncapitalize<S> {
  return (s.charAt(0).toLowerCase() + s.slice(1)) as Uncapitalize<S>;
}

/**
 * Binds every command in `commands` (keyed PascalCase, e.g. CreatePlace) to
 * dispatch, exposing camelCase methods (createPlace) — matching the existing
 * per-domain hooks' call-site convention. Pass `boundArg` (e.g. an
 * `activityId`) when every command in this domain shares that first
 * parameter, and it's pre-applied so callers omit it.
 */
export function useCommands<C extends Record<string, AnyCommandCreator>>(commands: C): { [K in keyof C as Uncapitalize<K & string>]: (...args: Parameters<C[K]>) => void };
export function useCommands<C extends Record<string, AnyCommandCreator>>(commands: C, boundArg: Parameters<C[keyof C]>[0]): { [K in keyof C as Uncapitalize<K & string>]: (...args: DropFirst<Parameters<C[K]>>) => void };
export function useCommands<C extends Record<string, AnyCommandCreator>>(commands: C, boundArg?: unknown) {
  const dispatch = useAppDispatch();
  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(commands).map(([key, creator]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyCreator = creator as (...args: any[]) => { type: string; payload: unknown };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bound = boundArg === undefined ? (...args: any[]) => dispatch(anyCreator(...args)) : (...args: any[]) => dispatch(anyCreator(boundArg, ...args));
          return [lowerFirst(key), bound];
        }),
      ) as never,
    [dispatch, commands, boundArg],
  );
}
