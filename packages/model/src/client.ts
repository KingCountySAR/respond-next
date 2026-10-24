import type { SyncClient } from '@sync/client';
import type { ActivityMutation } from '@sync/domain';

/** The app's sync client: `mutate` takes the activity mutations by name, with their args typed. */
export type ActivityClient = SyncClient<ActivityMutation>;