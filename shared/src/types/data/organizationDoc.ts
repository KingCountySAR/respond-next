import { MemberProviderType } from './MemberProviderType';

export interface MemberProviderConfig {
  provider: MemberProviderType;
  token: string;
  moreEmailsField: 'Secondary Email';
}

export const ORGS_COLLECTION = 'organizations';

export interface OrganizationPartner {
  id: string;
  title: string;
  rosterName?: string;
  canCreateEvents: boolean;
  canCreateMissions: boolean;
}

/**
 * Source app icon(s), keyed by pixel size, as `data:` URIs or `https://` URLs (not
 * required to be square/pre-resized — GET /api/icon/:size.png letterboxes as needed).
 * 512 is required as the universal fallback; the route serves an exact requested size
 * by using the closest available size that's >= it, falling back to 512 if none is.
 */
export interface OrganizationBrandIcons {
  512: string;
  192?: string;
  180?: string;
  32?: string;
  /**
   * Optional maskable-safe variants (icon content kept within the center ~80% "safe
   * zone" so OS adaptive-icon shapes don't crop it) — GET /api/icon/maskable/:size.png.
   * Falls back to the plain (non-maskable) entry at that size where a maskable one
   * isn't provided; the manifest only advertises purpose "maskable" at all once at
   * least one real maskable entry exists here, since a non-safe-zoned image declared
   * maskable risks visible clipping.
   */
  maskable?: {
    512?: string;
    192?: string;
    180?: string;
    32?: string;
  };
}

export interface OrganizationDoc {
  id: string;
  domain: string;
  title: string;
  rosterName?: string;
  mouName?: string;
  brand: {
    primary: string;
    primaryDark?: string;
    icon?: OrganizationBrandIcons;
  };
  memberProvider: MemberProviderConfig;
  canCreateEvents: boolean;
  canCreateMissions: boolean;
  supportEmail?: string;
  partners: OrganizationPartner[];
  tags?: {
    groupId: string;
    label: string;
  }[];
}
