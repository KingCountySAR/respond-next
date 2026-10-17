import type { Viewer } from '@sync/core';

export const TIERS = ['command', 'support', 'field'] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Who is acting or viewing. `tier` comes from the activity's grants; `class` says whether the person
 * belongs to the jurisdiction's identity source (member) or not (mutual aid, ad-hoc).
 */
export interface ActivityViewer extends Viewer {
  tier: Tier;
  class: 'member' | 'external';
  /** The viewer's own person, for self-service changes (signing in, ETA). */
  personRef?: string;
}

/** System mutations (member info, cross-activity sign-outs) run as this viewer. */
export const SYSTEM_VIEWER: ActivityViewer = { userId: 'system', tier: 'command', class: 'member' };

export const asActivityViewer = (viewer: Viewer): ActivityViewer => viewer as ActivityViewer;

/** Support uses the command rules for now; it's a separate tier so it can diverge later. */
export const isCommand = (viewer: Viewer): boolean => viewer.tier === 'command' || viewer.tier === 'support';
