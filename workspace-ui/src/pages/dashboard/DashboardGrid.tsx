import { useRef, useCallback, useState, type ReactNode, type DragEvent } from 'react';
import { cn } from '../../lib/utils';

// ── WidgetGrid ────────────────────────────────────────────────────

export interface WidgetGridProps {
  children: ReactNode;
  columns?: string;
  autoRows?: string;
  gap?: number;
  className?: string;
}

export function WidgetGrid({
  children,
  columns = '320px 1fr 420px',
  autoRows = '180px',
  gap = 4,
  className,
}: WidgetGridProps) {
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div
      className={cn('grid relative dashboard-grid', className)}
      data-grid-root
      style={{
        gridTemplateColumns: columns,
        gridAutoRows: autoRows,
        gap: `${gap * 4}px`,
      }}
      onDragOver={handleDragOver}
    >
      {children}
    </div>
  );
}

// ── WidgetCell ────────────────────────────────────────────────────

export interface WidgetCellProps {
  children: ReactNode;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  widgetId?: string;
  onResize?: (colSpan: number, rowSpan: number) => void;
  index?: number;
}

export function WidgetCell({
  children,
  colSpan = 1,
  rowSpan = 1,
  className,
  widgetId,
  onResize,
  index = 0,
}: WidgetCellProps) {
  const [dragOver, setDragOver] = useState(false);
  const [showSize, setShowSize] = useState<{ col: number; row: number } | null>(null);

  // ── Drag ────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: DragEvent) => {
    if (!widgetId) return;
    e.dataTransfer.setData('text/plain', widgetId);
    e.dataTransfer.effectAllowed = 'move';
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.4';
    setTimeout(() => { el.style.opacity = ''; }, 0);
  }, [widgetId]);

  const handleDragEnd = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDragOverCell = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }, []);

  const handleDragLeaveCell = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== widgetId && widgetId) {
      const event = new CustomEvent('widget:swap', {
        bubbles: true,
        detail: { from: draggedId, to: widgetId },
      });
      e.currentTarget?.dispatchEvent(event);
    }
  }, [widgetId]);

  // ── Resize ─────────────────────────────────────────────────────

  const resizeRef = useRef<{ startX: number; startY: number; col: number; row: number } | null>(null);
  const finalSizeRef = useRef<{ col: number; row: number }>({ col: colSpan, row: rowSpan });

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    finalSizeRef.current = { col: colSpan, row: rowSpan };
    resizeRef.current = { startX, startY, col: colSpan, row: rowSpan };
    setShowSize(finalSizeRef.current);

    const handleMouseMove = (me: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = me.clientX - resizeRef.current.startX;
      const dy = me.clientY - resizeRef.current.startY;
      const newCol = Math.max(1, Math.min(4, resizeRef.current.col + Math.round(dx / 80)));
      const newRow = Math.max(1, Math.min(3, resizeRef.current.row + Math.round(dy / 60)));
      finalSizeRef.current = { col: newCol, row: newRow };
      setShowSize(finalSizeRef.current);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      resizeRef.current = null;
      const final = finalSizeRef.current;
      setShowSize(null);
      if (onResize && (final.col !== colSpan || final.row !== rowSpan)) {
        onResize(final.col, final.row);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [colSpan, rowSpan, onResize]);

  const displayCol = showSize?.col ?? colSpan;
  const displayRow = showSize?.row ?? rowSpan;

  return (
    <div
      className={cn(
        'group/widget relative rounded-xl transition-shadow duration-150 widget-frame',
        'animate-card-in',
        dragOver && 'ring-2 ring-[var(--accent-blue)]/50',
        className,
      )}
      style={{
        gridColumn: `span ${displayCol}`,
        gridRow: `span ${displayRow}`,
        animationDelay: `${index * 60}ms`,
      }}
      draggable={!!widgetId}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOverCell}
      onDragLeave={handleDragLeaveCell}
      onDrop={handleDrop}
    >
      {/* Glass overlay */}
      <div className="glass-overlay" />

      {children}

      {/* Drag handle */}
      {widgetId && (
        <div
          className="drag-handle"
          style={{ touchAction: 'none' }}
          aria-label="Drag to reorder"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
            <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none" />
            <circle cx="5" cy="9" r="1" fill="currentColor" stroke="none" />
            <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
      )}

      {/* Resize handle */}
      {widgetId && (
        <div
          className="resize-handle"
          style={{ touchAction: 'none' }}
          onMouseDown={handleResizeStart}
          aria-label="Resize widget"
        />
      )}

      {/* Size indicator during resize */}
      {showSize && (
        <div
          className="absolute bottom-7 right-2 z-30 text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{
            background: '#25262b',
            color: '#e4e8ee',
            border: '1px solid #2c2e33',
          }}
        >
          {showSize.col} × {showSize.row}
        </div>
      )}
    </div>
  );
}
