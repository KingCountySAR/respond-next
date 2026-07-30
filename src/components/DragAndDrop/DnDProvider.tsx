import React, { createContext, ReactNode, useContext, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DraggedItem<T = any> {
  type: string;
  data: T;
  previewNode?: ReactNode;
}

export interface Position {
  x: number;
  y: number;
}

interface DnDContextType {
  activeItem: DraggedItem | null;
  position: Position;
  startDrag: (item: DraggedItem, e: React.PointerEvent<HTMLElement>) => void;
  updateDrag: (e: React.PointerEvent<HTMLElement>) => void;
  endDrag: (e: React.PointerEvent<HTMLElement>, onDropTargetFound: (element: HTMLElement) => void) => void;
}

const DnDContext = createContext<DnDContextType | null>(null);

export const DnDProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeItem, setActiveItem] = useState<DraggedItem | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

  const startDrag = (item: DraggedItem, e: React.PointerEvent<HTMLElement>) => {
    // Locks pointer events to this element even if pointer moves outside it
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setActiveItem(item);
    setPosition({ x: e.clientX, y: e.clientY });
  };

  const updateDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!activeItem) return;
    setPosition({ x: e.clientX, y: e.clientY });
  };

  const endDrag = (e: React.PointerEvent<HTMLElement>, onDropTargetFound: (element: HTMLElement) => void) => {
    if (!activeItem) return;

    const targetElement = e.target as HTMLElement;
    if (targetElement.hasPointerCapture(e.pointerId)) {
      targetElement.releasePointerCapture(e.pointerId);
    }

    // Identifies the element directly under the finger or cursor on drop
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (dropTarget) {
      onDropTargetFound(dropTarget);
    }

    setActiveItem(null);
  };

  return (
    <DnDContext.Provider value={{ activeItem, position, startDrag, updateDrag, endDrag }}>
      {children}
      {activeItem?.previewNode ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            transform: `translate3d(${position.x - 20}px, ${position.y - 20}px, 0)`,
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.9,
          }}
        >
          {activeItem.previewNode}
        </div>
      ) : null}
    </DnDContext.Provider>
  );
};

export const useDnD = (): DnDContextType => {
  const context = useContext(DnDContext);
  if (!context) throw new Error('useDnD must be used within a DnDProvider');
  return context;
};
