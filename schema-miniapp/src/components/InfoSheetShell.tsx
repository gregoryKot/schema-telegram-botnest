import type { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';

// Каркас инфо-шторки «зачем это»: BottomSheet + капс-заголовок. Один на все
// объясняющие оверлеи (InfoOverlays, BestDayInfoSheet) — правило «одна
// механика — один компонент»: каркас копировался четырежды, и jscpd честно
// считал каждую копию дублем.
export function InfoSheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 16,
          }}
        >
          {title}
        </div>
        {children}
      </div>
    </BottomSheet>
  );
}
