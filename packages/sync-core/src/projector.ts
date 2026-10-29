import type { Viewer } from './mutation';
import type { Rec } from './records';
import type { ReadView } from './tx';

/** The view key of someone who may not see an activity at all: it shows them nothing, and they change nothing. */
export const HIDDEN_VIEW = 'hidden';

/**
 * Decides what each viewer may see. This is the security boundary: the server sends nothing
 * that hasn't passed through `project`.
 */
export interface Projector {
  /**
   * Who the viewer is on this activity (`scopeId`), given its records, when that isn't who they are
   * (undefined). Checked again as the records change: a different view key gets the activity afresh.
   */
  viewerIn?(viewer: Viewer, view: ReadView, scopeId: string): Viewer | undefined;
  /** Viewers with the same key see identical projections, so changes are projected once per key. */
  viewKey(viewer: Viewer): string;
  /** The record as this view sees it (fields may be dropped), or null when it's not visible. */
  project(viewKey: string, rec: Rec): Rec | null;
}
