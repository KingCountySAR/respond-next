import type { Viewer } from '@sync/core';

export const TIERS = ['manage', 'respond'] as const;
export type Tier = (typeof TIERS)[number];

/** The tiers' names before 2026-10-25 (support was manage in all but name), as stored sessions, grants and organizations may still have them. */
const FORMER_TIERS: Record<string, Tier> = { command: 'manage', support: 'manage', field: 'respond' };

/** A stored or sent tier, in today's names. */
export const currentTier = <T>(tier: T): T | Tier => (typeof tier === 'string' && FORMER_TIERS[tier]) || tier;

/**
 * Who is acting or viewing. `tier` comes from the activity's grants; `class` says whether the person
 * belongs to the jurisdiction's identity source (member) or not (mutual aid, ad-hoc).
 */
export interface ActivityViewer extends Viewer {
  tier: Tier;
  class: 'member' | 'external';
  /** The viewer's own person, for self-service changes (signing in, ETA). */
  personRef?: string;
  /** Their name, as signed in: the activity log says who made each change. */
  name?: string;
  /**
   * Their tier were the activity a mission, when its kind is what lets them manage it: members
   * manage trainings and other events. Only that tier may make one a mission.
   */
  missionTier?: Tier;
  /** Server side: the site they signed in on, which decides the activities they may see (`siteActivityProjector`). */
  siteId?: string;
  /** On an activity their site may not see: they see none of it, and change nothing. */
  hidden?: boolean;
}

/** System mutations (member info, cross-activity sign-outs) run as this viewer. */
export const SYSTEM_VIEWER: ActivityViewer = { userId: 'system', tier: 'manage', class: 'member' };

export const asActivityViewer = (viewer: Viewer): ActivityViewer => viewer as ActivityViewer;

/** The server acting for itself (SYSTEM_VIEWER): member info, summaries, cross-activity sign-outs. */
export const isSystemViewer = (viewer: Viewer): boolean => viewer.userId === SYSTEM_VIEWER.userId;

export const canManage = (viewer: Viewer): boolean => viewer.tier === 'manage';

/** Whether they manage missions: their own tier (with any grant), not one an event's kind gives them. */
export const canManageMissions = (viewer: Viewer): boolean => canManage({ ...viewer, tier: asActivityViewer(viewer).missionTier ?? viewer.tier });
