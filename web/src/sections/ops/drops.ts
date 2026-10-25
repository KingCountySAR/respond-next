/** What can be dragged on the dashboard, and what dropping it somewhere does. */
import { sameTarget, type Target } from '@sync/domain';
import type { ManageActivity, ManageEquipment } from '@sync/model';

/** An item that exists, or a catalog type (named, for a custom item) to create where it's dropped. */
export type EquipmentDrag = { item: ManageEquipment } | { typeId: string; name?: string };

/** Moves the item there, or creates one from the catalog there. Nothing if it's already there. */
export function dropEquipment(activity: ManageActivity, drag: EquipmentDrag, target: Target | null): void {
  if ('item' in drag) {
    if (!sameTarget(drag.item.assignedTo, target)) drag.item.assign(target);
    return;
  }
  if (target) activity.addEquipment(drag.typeId, target, { name: drag.name });
}
