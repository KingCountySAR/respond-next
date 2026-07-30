import React, { ReactNode, useEffect, useRef } from 'react';

import { DraggedItem, useDnD } from './DnDProvider';

// --- <Draggable /> ---
interface DraggableProps<T> {
  type: string;
  item: T;
  children: ReactNode;
}

export function Draggable<T>({ type, item, children }: DraggableProps<T>) {
  const { startDrag, updateDrag, endDrag } = useDnD();

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Prevents text selection during drag
    e.stopPropagation();
    startDrag({ type, data: item, previewNode: children }, e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e, (targetElement) => {
      // Finds closest droppable ancestor and dispatches a synthetic drop event
      const droppable = targetElement.closest<HTMLElement>('[data-droppable]');
      if (droppable) {
        droppable.dispatchEvent(
          new CustomEvent('custom-drop', {
            bubbles: true,
            detail: { type, data: item },
          }),
        );
      }
    });
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={updateDrag}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        touchAction: 'none', // Critical: prevents mobile browser scrolling while dragging
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}

// --- <Droppable /> ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DroppableProps {
  accepts?: string | string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDrop: (draggedItem: any, type: string) => void; // Accepts any dropped payload
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
      const customEvent = e as CustomEvent<DraggedItem>;
      // Only handle the event if this element is the original target the event was dispatched on.
      if (e.target !== element) return;
      if (isAccepted(customEvent.detail.type)) {
        onDrop(customEvent.detail.data, customEvent.detail.type);
      }
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
