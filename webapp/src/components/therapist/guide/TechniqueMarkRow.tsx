import { JournalLink } from '../../../../../shared/src/therapy/conceptGraph/JournalLink';
import { markButtonLabel } from './guideJournal';

/** «Делали сегодня» у техники, открытой из раздела режима или схемы клиента. */
export interface TechniqueMarkProps {
  /** «делали 2 раза, последний 5 ноя»; ни разу — null. */
  note: string | null;
  /** Отметка дня стоит — кнопка её снимает. */
  marked: boolean;
  /** День строки журнала техник, если не сегодня; нет — кнопка про сегодня. */
  day?: string;
  onToggle: () => void;
  /** «журнал →» за строкой «делали …»; нет (лист открыт из журнала) — без ссылки. */
  onOpenJournal?: () => void;
}

/** «делали …» серым, за ней «журнал →»; нечего сказать — ничего. Лист техники и лист раздела. */
export function TechniqueDoneNote({ text, onOpenJournal }: { text?: string | null; onOpenJournal?: () => void }) {
  if (!text) return null;
  return (
    <div className="ds-sub">
      <span>{text}</span>
      {onOpenJournal && <> · <JournalLink onClick={onOpenJournal} /></>}
    </div>
  );
}

/**
 * Строка отметки в листе техники (#995): сколько раз делали и кнопка «Делали
 * сегодня»; повторный тап в тот же день — «Отменить сегодняшнюю отметку». Из
 * журнала техник лист открывается с днём строки — кнопка снимает отметку того
 * дня. Отметка — журнал терапевта в схеме случая (guideJournal.ts), клиенту не видна.
 */
export function TechniqueMarkRow({ note, marked, day, onToggle, onOpenJournal }: TechniqueMarkProps) {
  return (
    <div className="tcp-guide-task">
      <div style={{ minWidth: 0 }}>
        {note ? <TechniqueDoneNote text={note} onOpenJournal={onOpenJournal} /> : <div className="ds-sub">Пока не отмечали</div>}
        <div className="ds-sub">Отметка остаётся в схеме случая, клиенту она не видна.</div>
      </div>
      <button type="button" className="ds-btn ds-btn--secondary" onClick={onToggle}>
        {markButtonLabel(marked, day)}
      </button>
    </div>
  );
}
