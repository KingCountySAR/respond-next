import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { SxProps, Theme } from '@mui/material';
import React, { ReactNode, useEffect, useRef, useState } from 'react';

import { DraggedItem, useDnD } from './DnDProvider';

// --- <Draggable /> ---
interface DraggableProps<Thin, Thick = Thin> {
  type: string;
  item: Thin;
  // Optional async hydration run by the accepting Droppable on drop; return null to cancel.
  transform?: (item: Thin) => Promise<Thick | null> | Thick | null;
  children: ReactNode;
}

export function Draggable<Thin, Thick = Thin>({ type, item, transform, children }: DraggableProps<Thin, Thick>) {
  const { startDrag, updateDrag, endDrag } = useDnD();
  const [isDraggingPointer, setIsDraggingPointer] = useState(false);
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasStartedDragRef = useRef(false);
  const DRAG_START_THRESHOLD_PX = 6;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Prevent parent wrappers from competing for pointer events.
    e.stopPropagation();
    dragStartPointRef.current = { x: e.clientX, y: e.clientY };
    hasStartedDragRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const dragStartPoint = dragStartPointRef.current;
    if (!dragStartPoint) return;

    if (!hasStartedDragRef.current) {
      const deltaX = e.clientX - dragStartPoint.x;
      const deltaY = e.clientY - dragStartPoint.y;
      const movedDistance = Math.hypot(deltaX, deltaY);

      if (movedDistance < DRAG_START_THRESHOLD_PX) return;

      hasStartedDragRef.current = true;
      setIsDraggingPointer(true);
      startDrag({ type, data: item, transform, previewNode: children }, e);
    }

    updateDrag(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hasStartedDragRef.current) {
      setIsDraggingPointer(false);
      endDrag(e, (targetElement) => {
        // Finds closest droppable ancestor and dispatches a synthetic drop event.
        const droppable = targetElement.closest<HTMLElement>('[data-droppable]');
        if (droppable) {
          droppable.dispatchEvent(
            new CustomEvent('custom-drop', {
              bubbles: true,
              detail: { type, data: item, transform },
            }),
          );
        }
      });
    }

    dragStartPointRef.current = null;
    hasStartedDragRef.current = false;
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        touchAction: 'none', // Critical: prevents mobile browser scrolling while dragging
        cursor: isDraggingPointer ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}

export function DragHandle({ sx }: { sx?: SxProps<Theme> }) {
  const baseSx: SxProps<Theme> = { fontSize: 16, color: 'text.secondary', opacity: 0.55 };
  return <DragIndicatorIcon className="drag-handle" sx={[baseSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} />;
}

// --- <Droppable /> ---

interface DroppableProps {
  accepts?: string | string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDrop: (draggedItem: any, type: string) => void; // Accepts any (optionally hydrated) dropped payload
  children: ReactNode;
  grow?: boolean;
}

export function Droppable({ accepts, onDrop, children, grow }: DroppableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const isAccepted = (type?: string): boolean => {
      if (!accepts) return true;
      if (!type) return false;
      return Array.isArray(accepts) ? accepts.includes(type) : accepts === type;
    };

    const handleCustomDrop = (e: Event) => {
      const { type, data, transform } = (e as CustomEvent<DraggedItem>).detail;
      // Only handle the event if this element is the original target the event was dispatched on.
      if (e.target !== element) return;
      if (!isAccepted(type)) return;
      // Hydrate (possibly async) before delivering; a null result cancels the drop.
      Promise.resolve(transform ? transform(data) : data).then((resolved) => {
        if (resolved != null) onDrop(resolved, type);
      });
    };

    element.addEventListener('custom-drop', handleCustomDrop);
    return () => element.removeEventListener('custom-drop', handleCustomDrop);
  }, [accepts, onDrop]);

  return (
    <div data-droppable ref={containerRef} style={grow ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined}>
      {children}
    </div>
  );
}
