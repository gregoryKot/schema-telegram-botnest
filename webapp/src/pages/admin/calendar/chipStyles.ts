// Цвет чипа по состоянию — общий источник для SlotChip и легенды в
// CalendarWeek (правило «одна механика — один компонент», легенда не
// копирует стили инлайном). Отдельный файл, не внутри SlotChip.tsx: файл,
// экспортирующий компонент, обязан экспортировать ТОЛЬКО компоненты
// (eslint react-refresh/only-export-components).
import type { CSSProperties } from 'react';
import type { AdminCalendarCellState } from '../../../api';

export function chipStyles(state: AdminCalendarCellState): CSSProperties {
  switch (state) {
    case 'free':
      return { background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)', border: '1.5px solid var(--accent-green)', color: 'var(--text)' };
    case 'extra':
      return { background: 'color-mix(in srgb, var(--accent-green) 16%, transparent)', border: '1.5px dashed var(--accent-green)', color: 'var(--text)' };
    case 'busy':
      return { background: 'color-mix(in srgb, var(--accent-yellow) 18%, transparent)', border: '1.5px solid var(--accent-yellow)', color: 'var(--text-sub)' };
    case 'blocked':
      return { background: 'var(--surface-3)', border: '1.5px solid transparent', color: 'var(--text-faint)', textDecoration: 'line-through' };
    case 'booked':
      return { background: 'var(--accent)', border: '1.5px solid var(--accent)', color: 'var(--on-accent)' };
    case 'off':
      return { background: 'transparent', border: '1.5px dashed var(--line-strong)', color: 'var(--text-ghost)' };
  }
}
