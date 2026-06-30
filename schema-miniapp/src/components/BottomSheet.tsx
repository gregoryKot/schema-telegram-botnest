import { useEffect, useRef, useState } from 'react';

interface Props {
  onClose: () => void;
  children: React.ReactNode;
  zIndex?: number;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

const HINT_KEY = 'sheet_close_hint_shown';

export function BottomSheet({ onClose, children, zIndex = 200, scrollRef }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const [showHint, setShowHint] = useState(() => !localStorage.getItem(HINT_KEY));

  useEffect(() => {
    if (!showHint) return;
    localStorage.setItem(HINT_KEY, '1');
    const t = setTimeout(() => setShowHint(false), 2800);
    return () => clearTimeout(t);
  }, [showHint]);

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
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex,
          background: 'rgba(0,0,0,0.55)',
          animation: 'fade-in 200ms ease',
        }}
      />
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: zIndex + 1,
          background: 'var(--sheet-bg)',
          borderRadius: '24px 24px 0 0',
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

        {/* One-time close hint */}
        {showHint && (
          <div style={{
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-sub)',
            padding: '0 0 10px',
            animation: 'fade-in 300ms ease',
            flexShrink: 0,
          }}>
            Нажми на заголовок чтобы закрыть
          </div>
        )}

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1, padding: '0 24px 48px' }}>
          {children}
        </div>
      </div>
    </>
  );
}
