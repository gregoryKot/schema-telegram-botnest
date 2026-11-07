/** «Делали сегодня» у техники, открытой из раздела режима или схемы клиента. */
export interface TechniqueMarkProps {
  /** «делали 2 раза, последний 5 ноя»; ни разу — null. */
  note: string | null;
  /** Сегодня уже отмечено — кнопка снимает отметку. */
  today: boolean;
  onToggle: () => void;
}

/**
 * Строка отметки в листе техники (#995): сколько раз делали и кнопка «Делали
 * сегодня»; повторный тап в тот же день — «Отменить сегодняшнюю отметку».
 * Отметка — журнал терапевта в схеме случая (guideJournal.ts), клиенту не видна.
 */
export function TechniqueMarkRow({ note, today, onToggle }: TechniqueMarkProps) {
  return (
    <div className="tcp-guide-task">
      <div style={{ minWidth: 0 }}>
        <div className="ds-sub">{note ?? 'Пока не отмечали'}</div>
        <div className="ds-sub">Отметка остаётся в схеме случая, клиенту она не видна.</div>
      </div>
      <button type="button" className="ds-btn ds-btn--secondary" onClick={onToggle}>
        {today ? 'Отменить сегодняшнюю отметку' : 'Делали сегодня'}
      </button>
    </div>
  );
}
