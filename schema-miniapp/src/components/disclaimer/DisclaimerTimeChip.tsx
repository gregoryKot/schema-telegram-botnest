import type { ReactNode } from 'react';

// Чип «сколько это занимает» для шагов онбординга — один компонент вместо
// копий блока по шагам (правило «одна механика — один компонент»).
// Значка часов нет: строка и так начинается со времени.
export function DisclaimerTimeChip({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '13px 16px',
        borderRadius: 14,
        background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
