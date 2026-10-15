import type { Viewer } from './mutation';
import type { Rec } from './records';

/**
 * Decides what each viewer may see. This is the security boundary: the server sends nothing
 * that hasn't passed through `project`.
 */
export interface Projector {
  /** Viewers with the same key see identical projections, so changes are projected once per key. */
  viewKey(viewer: Viewer): string;
  /** The record as this view sees it (fields may be dropped), or null when it's not visible. */
  project(viewKey: string, rec: Rec): Rec | null;
}
