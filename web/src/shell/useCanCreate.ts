import { canCreate } from '@sync/domain';
import { useSite } from './App';
import { useAuth } from './auth';

/**
 * What the signed-in person may create here, as the legacy app: when the organization (or a
 * partner) may create that kind. Only managers may create missions; members may create other
 * events too.
 */
export function useCanCreate(): { missions: boolean; events: boolean } {
  const { session } = useAuth();
  const org = useSite().organization;
  const manager = session?.tier === 'manage';
  return {
    missions: manager && canCreate(org, true),
    events: (manager || session?.class === 'member') && canCreate(org, false),
  };
}
