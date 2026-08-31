import type { ReactNode } from 'react';
import { SectionLabel } from '../SectionLabel';
import { pressable } from '../../utils/a11y';

// Раскрывающаяся секция листа потребности: заголовок с галочкой и тело.
// Скелет был скопирован трижды (примеры, вопросы рефлексии, шкала оценок)
// и различался только подписью и содержимым — вынесено из
// NeedTodaySheet.tsx (правило №10 + «одна механика — один компонент»).
export function CollapsibleSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        {...pressable(onToggle)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: open ? 10 : 0,
        }}
      >
        <SectionLabel mb={0}>{label}</SectionLabel>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          {open ? '▴' : '▾'}
        </span>
      </div>
      {open && children}
    </div>
  );
}
