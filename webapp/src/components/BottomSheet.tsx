import { useEffect, useRef } from 'react';

interface Props {
  onClose: () => void;
  children: React.ReactNode;
  zIndex?: number;
  scrollRef?: React.RefObject<HTMLDivElement>;
  /** Width cap for desktop modal (default 560) */
  width?: number;
}

export function BottomSheet({ onClose, children, zIndex = 200, scrollRef, width = 560 }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Mobile drag-to-close handlers
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    const dy = Math.max(0, e.clientY - startY.current);
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onHandleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const dy = e.clientY - startY.current;
    if (sheetRef.current) sheetRef.current.style.transform = '';
    if (dy > 80) onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex,
          background: 'rgba(0,0,0,0.45)',
          animation: 'fade-in 200ms ease',
        }}
      />

      {/* Desktop: centered modal */}
      <div className="bottom-sheet-desktop" style={{ zIndex: zIndex + 1, '--modal-width': `${width}px` } as React.CSSProperties}>
        <div
          ref={sheetRef}
          style={{
            background: 'var(--bg-elev, var(--bg))',
            borderRadius: 16,
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 48px rgba(0,0,0,0.18)',
            animation: 'modal-in 220ms cubic-bezier(0.34, 1.4, 0.64, 1)',
          }}
        >
          {/* Scrollable content */}
          <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1, padding: '28px 28px 32px' }}>
            {children}
          </div>
        </div>
      </div>

      {/* Mobile: bottom sheet (hidden on desktop via CSS) */}
      <div className="bottom-sheet-mobile" style={{ zIndex: zIndex + 1 }}>
        <div
          ref={sheetRef}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--bg-elev, var(--sheet-bg, var(--bg)))',
            borderRadius: '20px 20px 0 0',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            animation: 'sheet-up 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Drag handle */}
          <div
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            style={{
              padding: '12px 0 6px',
              display: 'flex', justifyContent: 'center',
              cursor: 'grab', flexShrink: 0,
              touchAction: 'none',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--fg-rgb),0.15)' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 48px' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
