/** Equipment types */
export const EQUIPMENT_CATALOG = [
  { id: 'inventory-0', category: 'Custom', name: 'Custom Item' },
  { id: 'inventory-1', category: 'Rigging', name: 'Anchor Rope (150)' },
  { id: 'inventory-2', category: 'Medical', name: 'Body Bag' },
  { id: 'inventory-3', category: 'Rigging', name: 'Climbing Rack' },
  { id: 'inventory-4', category: 'Rigging', name: 'Climbing Rope' },
  { id: 'inventory-5', category: 'General', name: 'Dog Rescue Kit' },
  { id: 'inventory-6', category: 'General', name: 'Drone' },
  { id: 'inventory-7', category: 'Medical', name: 'EMT Kit' },
  { id: 'inventory-8', category: 'Medical', name: 'First Aid Kit' },
  { id: 'inventory-9', category: 'Rigging', name: 'Helmet' },
  { id: 'inventory-10', category: 'Medical', name: 'Ice Pack' },
  { id: 'inventory-11', category: 'Packaging', name: 'Litter' },
  { id: 'inventory-12', category: 'Medical', name: 'Oxygen' },
  { id: 'inventory-13', category: 'Packaging', name: 'Sleeping Bag' },
  { id: 'inventory-14', category: 'Rigging', name: 'Patient Harness' },
  { id: 'inventory-15', category: 'Rigging', name: 'Rigging Kit' },
  { id: 'inventory-16', category: 'Rigging', name: 'Rope (300)' },
  { id: 'inventory-17', category: 'Rigging', name: 'Rope (600)' },
  { id: 'inventory-18', category: 'Medical', name: 'Warming Blanket' },
  { id: 'inventory-19', category: 'Packaging', name: 'Wheel' },
  { id: 'inventory-20', category: 'General', name: 'Water' },
  { id: 'inventory-21', category: 'General', name: 'Snacks' },
  { id: 'inventory-22', category: 'General', name: 'Stove' },
  { id: 'inventory-23', category: 'Packaging', name: 'Tarp' },
  { id: 'inventory-24', category: 'General', name: 'Saw' },
  { id: 'inventory-25', category: 'General', name: 'Traction' },
  { id: 'inventory-26', category: 'General', name: 'Snowshoes' },
  { id: 'inventory-27', category: 'Packaging', name: 'Mega Mover' },
  { id: 'inventory-28', category: 'Packaging', name: 'Foam Pad' },
  { id: 'inventory-29', category: 'Packaging', name: 'Padding' },
  { id: 'inventory-30', category: 'Medical', name: 'Vacuum Splint: Full Body' },
  { id: 'inventory-31', category: 'Medical', name: 'Vacuum Splint: Extremity' },
  { id: 'inventory-32', category: 'Medical', name: 'SAM Splint' },
  { id: 'inventory-33', category: 'General', name: 'Webbing' },
  { id: 'inventory-34', category: 'Medical', name: 'A.E.D - Basic' },
  { id: 'inventory-35', category: 'Medical', name: 'A.E.D - EMT' },
  { id: 'inventory-36', category: 'Medical', name: 'Backboard' },
  { id: 'inventory-37', category: 'Rigging', name: 'Bolt Kit' },
  { id: 'inventory-38', category: 'Packaging', name: 'Packaging' },
] as const;

export type EquipmentType = (typeof EQUIPMENT_CATALOG)[number];

/** The catalogue entry whose name the user supplies. */
export const CUSTOM_EQUIPMENT_TYPE_ID = 'inventory-0';

export const equipmentType = (typeId: string): EquipmentType | undefined => EQUIPMENT_CATALOG.find((t) => t.id === typeId);
