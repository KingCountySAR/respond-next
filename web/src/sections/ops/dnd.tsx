/**
 * The legacy dashboard's pointer drag and drop: works with a mouse or a finger. A Draggable shows a
 * preview under the pointer and, on release, sends a `custom-drop` event to the closest Droppable
 * under it.
 */
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import type { SxProps, Theme } from '@mui/material';
import { createContext, useContext, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

type Transform = (item: any) => Promise<unknown> | unknown;

interface DraggedItem {
  type: string;
  data: unknown;
  /** Runs in the accepting Droppable before its onDrop; null cancels the drop (e.g. a dismissed form). */
  transform?: Transform;
  previewNode?: ReactNode;
}

interface Position {
  x: number;
  y: number;
}

interface DnDContextType {
  startDrag(item: DraggedItem, e: PointerEvent<HTMLElement>): void;
  updateDrag(e: PointerEvent<HTMLElement>): void;
  endDrag(e: PointerEvent<HTMLElement>, onDropTargetFound: (element: HTMLElement) => void): void;
}

const DnDContext = createContext<DnDContextType | null>(null);

export function DnDProvider({ children }: { children: ReactNode }) {
  const [activeItem, setActiveItem] = useState<DraggedItem | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

  const startDrag = (item: DraggedItem, e: PointerEvent<HTMLElement>) => {
    // Keeps the pointer's events on this element even when it moves outside it.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const containerRect = e.currentTarget.getBoundingClientRect();
    const handleRect = e.currentTarget.querySelector<HTMLElement>('.drag-handle')?.getBoundingClientRect();
    const offset = handleRect
      ? { x: handleRect.left + handleRect.width / 2 - containerRect.left, y: handleRect.top + handleRect.height / 2 - containerRect.top }
      : { x: containerRect.width / 2, y: containerRect.height / 2 };
    setActiveItem(item);
    setDragOffset(offset);
    setPosition({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const updateDrag = (e: PointerEvent<HTMLElement>) => {
    if (!activeItem) return;
    setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
  };

  const endDrag = (e: PointerEvent<HTMLElement>, onDropTargetFound: (element: HTMLElement) => void) => {
    if (!activeItem) return;
    const target = e.currentTarget;
    if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
    // The element under the finger or cursor.
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (dropTarget) onDropTargetFound(dropTarget);
    setActiveItem(null);
    setDragOffset({ x: 0, y: 0 });
  };

  return (
    <DnDContext.Provider value={{ startDrag, updateDrag, endDrag }}>
      {children}
      {activeItem?.previewNode ? (
        <div style={{ position: 'fixed', top: 0, left: 0, transform: `translate3d(${position.x}px, ${position.y}px, 0)`, pointerEvents: 'none', zIndex: 9999, opacity: 0.9 }}>{activeItem.previewNode}</div>
      ) : null}
    </DnDContext.Provider>
  );
}

const useDnD = (): DnDContextType => {
  const context = useContext(DnDContext);
  if (!context) throw new Error('useDnD must be used within a DnDProvider');
  return context;
};

const DRAG_START_THRESHOLD_PX = 6;

export function Draggable<T>({ type, item, transform, children }: { type: string; item: T; transform?: (item: T) => Promise<unknown> | unknown; children: ReactNode }) {
  const { startDrag, updateDrag, endDrag } = useDnD();
  const [isDragging, setIsDragging] = useState(false);
  const startPoint = useRef<Position | null>(null);
  const started = useRef(false);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Keeps an enclosing Draggable from starting too.
    e.stopPropagation();
    startPoint.current = { x: e.clientX, y: e.clientY };
    started.current = false;
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const from = startPoint.current;
    if (!from) return;
    if (!started.current) {
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_START_THRESHOLD_PX) return;
      started.current = true;
      setIsDragging(true);
      startDrag({ type, data: item, transform: transform as Transform | undefined, previewNode: children }, e);
    }
    updateDrag(e);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (started.current) {
      setIsDragging(false);
      endDrag(e, (element) => {
        element.closest<HTMLElement>('[data-droppable]')?.dispatchEvent(new CustomEvent('custom-drop', { bubbles: true, detail: { type, data: item, transform } }));
      });
    }
    startPoint.current = null;
    started.current = false;
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // touch-action none keeps a mobile browser from scrolling while dragging.
      style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {children}
    </div>
  );
}

export function DragHandle({ sx }: { sx?: SxProps<Theme> }) {
  return <DragIndicatorIcon className="drag-handle" sx={[{ fontSize: 16, color: 'text.secondary', opacity: 0.55 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} />;
}

/** Takes drops of the `accepts` types (all when unset) whose closest Droppable is this one. */
export function Droppable({ accepts, onDrop, children, grow }: { accepts?: string | string[]; onDrop: (item: any, type: string) => void; children: ReactNode; grow?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const isAccepted = (type?: string) => !accepts || (!!type && (Array.isArray(accepts) ? accepts.includes(type) : accepts === type));
    const handleDrop = (e: Event) => {
      const { type, data, transform } = (e as CustomEvent<DraggedItem>).detail;
      if (e.target !== element || !isAccepted(type)) return;
      void Promise.resolve(transform ? transform(data) : data).then((resolved) => {
        if (resolved != null) onDrop(resolved, type);
      });
    };
    element.addEventListener('custom-drop', handleDrop);
    return () => element.removeEventListener('custom-drop', handleDrop);
  }, [accepts, onDrop]);

  return (
    <div data-droppable ref={ref} style={grow ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined}>
      {children}
    </div>
  );
}
