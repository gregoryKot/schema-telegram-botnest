import { useEffect, useRef } from 'react';

interface Props {
  onLeft: (v: boolean) => void;
  onRight: (v: boolean) => void;
  onJump: () => void;
}

function DPadBtn({
  label, onDown, onUp, style,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const down = (e: TouchEvent) => { e.preventDefault(); onDown(); };
    const up = (e: TouchEvent) => { e.preventDefault(); onUp(); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, [onDown, onUp]);

  return (
    <button
      ref={ref}
      style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'rgba(255,255,255,0.18)',
        border: '2px solid rgba(255,255,255,0.3)',
        color: '#fff', fontSize: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', touchAction: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {label}
    </button>
  );
}

export function TouchControls({ onLeft, onRight, onJump }: Props) {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 0, right: 0,
      display: 'flex', justifyContent: 'space-between',
      padding: '0 20px', pointerEvents: 'none',
    }}>
      {/* D-pad */}
      <div style={{ display: 'flex', gap: 10, pointerEvents: 'all' }}>
        <DPadBtn
          label="◀"
          onDown={() => onLeft(true)}
          onUp={() => onLeft(false)}
        />
        <DPadBtn
          label="▶"
          onDown={() => onRight(true)}
          onUp={() => onRight(false)}
        />
      </div>

      {/* Jump */}
      <div style={{ pointerEvents: 'all' }}>
        <DPadBtn
          label="↑"
          onDown={onJump}
          onUp={() => {}}
          style={{ width: 64, height: 64, borderRadius: '50%', fontSize: 26 }}
        />
      </div>
    </div>
  );
}
