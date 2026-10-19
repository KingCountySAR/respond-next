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
  /**
   * Their tier were the activity a mission, when its kind is what makes them command: members
   * manage trainings and other events. Only that tier may make one a mission.
   */
  missionTier?: Tier;
}

/** System mutations (member info, cross-activity sign-outs) run as this viewer. */
export const SYSTEM_VIEWER: ActivityViewer = { userId: 'system', tier: 'command', class: 'member' };

export const asActivityViewer = (viewer: Viewer): ActivityViewer => viewer as ActivityViewer;

/** The server acting for itself (SYSTEM_VIEWER): member info, summaries, cross-activity sign-outs. */
export const isSystemViewer = (viewer: Viewer): boolean => viewer.userId === SYSTEM_VIEWER.userId;

/** Support uses the command rules for now; it's a separate tier so it can diverge later. */
export const isCommand = (viewer: Viewer): boolean => viewer.tier === 'command' || viewer.tier === 'support';

/** Whether they're command on missions: their own tier (with any grant), not one an event's kind gives them. */
export const isMissionCommand = (viewer: Viewer): boolean => isCommand({ ...viewer, tier: asActivityViewer(viewer).missionTier ?? viewer.tier });
