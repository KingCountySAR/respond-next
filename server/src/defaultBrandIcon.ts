import { readFileSync } from 'fs';
import { join } from 'path';

import type { OrganizationBrandIcons } from '@shared/types/data/organizationDoc';

import { SERVER_ASSETS_DIR } from './packageFiles';

// Generic placeholder icon (map pin), used when an org has no brand.icon configured.
// Source: server/assets/icon-512.png (icon.svg alongside it is the vector source —
// not used directly here, the icon resize route can't decode SVG). Ships as part of the
// app, so a missing file is a real error, not a fallback case.
export const DEFAULT_BRAND_ICON: OrganizationBrandIcons = {
  512: `data:image/png;base64,${readFileSync(join(SERVER_ASSETS_DIR, 'icon-512.png')).toString('base64')}`,
};
