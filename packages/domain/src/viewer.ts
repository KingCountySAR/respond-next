import type { Viewer } from '@sync/core';

export const TIERS = ['command', 'support', 'field'] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Who is acting or viewing. `tier` comes from the event's grants; `class` says whether the person
 * belongs to the jurisdiction's identity source (member) or not (mutual aid, ad-hoc).
 */
export interface MissionViewer extends Viewer {
  tier: Tier;
  class: 'member' | 'external';
  /** The viewer's own person, for self-service changes (signing in, ETA). */
  personRef?: string;
}

/** System mutations (member info, cross-event sign-outs) run as this viewer. */
export const SYSTEM_VIEWER: MissionViewer = { userId: 'system', tier: 'command', class: 'member' };

export const asMissionViewer = (viewer: Viewer): MissionViewer => viewer as MissionViewer;

/** Support uses the command rules for now; it's a separate tier so it can diverge later. */
export const isCommand = (viewer: Viewer): boolean => viewer.tier === 'command' || viewer.tier === 'support';
