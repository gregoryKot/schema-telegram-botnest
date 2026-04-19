import { useRef, useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  children: React.ReactNode;
  zIndex?: number;
}

const HINT_KEY = 'diary_sheet_hint';

export function BottomSheet({ onClose, children, zIndex = 200 }: Props) {
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
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex,
        background: 'rgba(0,0,0,0.6)',
        animation: 'fade-in 200ms ease',
      }} />
      <div ref={sheetRef} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: zIndex + 1,
        background: '#141620',
        borderRadius: '22px 22px 0 0',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'sheet-up 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.5)',
      }}>
        {/* Drag handle area */}
        <div
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          style={{ padding: '14px 0 6px', display: 'flex', justifyContent: 'center', cursor: 'grab', flexShrink: 0, touchAction: 'none' }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        {showHint && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', paddingBottom: 8, animation: 'fade-in 300ms ease', flexShrink: 0 }}>
            Потяни вниз, чтобы закрыть
          </div>
        )}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 48px' }}>
          {children}
        </div>
      </div>
    </>
  );
}
