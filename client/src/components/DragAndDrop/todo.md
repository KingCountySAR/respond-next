# Planned Drag-and-Drop Hover Feedback

## Goal

While an item is dragged, the droppable directly beneath the pointer should expose whether it accepts the item's type. Each child surface should own its visual response rather than the Droppable wrapper applying styles.

## Drag State

- Add `dropTarget: HTMLElement | null` to the DnD context.
- During `updateDrag`, use `document.elementFromPoint()` and `closest('[data-droppable]')` to track the hovered droppable.
- Clear `dropTarget` when the drag ends.

## Droppable Contract

- Determine eligibility from `accepts` and `activeItem.type`.
- When the direct child is a custom component, clone it with `isDropTarget` set only when it is both hovered and eligible.
- For native element children, set a `data-drop-target` attribute so CSS can style the element.
- Preserve the existing drop event behavior and `grow` layout wrapper.

## Shared Visual Style

- Export a reusable `dropTargetSx(isDropTarget, hasBorder)` helper.
- Active targets use `primary.main` for the border and `action.hover` for the background, with a 120ms transition.
- Borderless targets reserve a transparent 1px border and radius 2 at rest so hover does not cause layout shifts.
- Bordered targets retain their normal divider border at rest and only change its color when active.

## Initial Consumers

- `DashboardBoxWithTitle`
- `DashboardRoleTile`
- Resource panel body
- Group leader target
- Team header and expanded body
