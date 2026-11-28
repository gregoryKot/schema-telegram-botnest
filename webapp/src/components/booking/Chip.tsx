// Чип-кнопка визитки: день/время слота, канал связи, валюта, формат встречи (одна механика — один компонент).
// Вид — чип на линии (.pa-chip--line, paper-app.css): ряд кладётся в .pa-chips-line. note — тихая вторая строка.
import type { ReactNode } from 'react';

export function Chip({ active, onClick, children, note }: { active: boolean; onClick: () => void; children: ReactNode; note?: ReactNode }) {
  const cls = ['ds-chip pa-chip pa-chip--line', note != null && 'pa-chip--note', active && 'is-on'].filter(Boolean).join(' ');
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cls}>
      {note == null ? children : <><span>{children}</span><span className="pa-chip-note">{note}</span></>}
    </button>
  );
}
