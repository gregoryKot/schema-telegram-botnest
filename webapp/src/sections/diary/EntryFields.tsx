// Поля раскрытой записи ленты «Записей» (b11, diary-entry-expanded): подпись строкой и текст под ней,
// на компьютере — в две колонки. Ответ Здорового Взрослого («Здоровый взгляд» в дневнике схем,
// «Здоровый Взрослый» в дневнике режимов) — вставка голоса Здорового Взрослого (HealthyVoice, та же,
// что пример в мастере режимов) на всю ширину: главный ответ записи виден сразу.
import { HealthyVoice } from '../../components/paper/HealthyVoice';
import type { FieldRow } from './entryRows';

export function ExpandField({ label, text, mark }: { label: string; text: string; mark?: FieldRow[2] }) {
  if (mark === 'healthy') return <HealthyVoice label={label} text={text} className="cd-field cd-field--healthy" />;
  return (
    <div className="cd-field">
      <div className={'cd-field-label' + (mark === 'accent' ? ' is-accent' : '')}>{label}</div>
      <div className="cd-field-text">{text}</div>
    </div>
  );
}

/** Заполненные поля записи; пустые не показываются. */
export function EntryFields({ rows }: { rows: FieldRow[] }) {
  return (
    <div className="cd-fields">
      {rows.filter(([, text]) => text).map(([label, text, mark]) => <ExpandField key={label} label={label} text={text!} mark={mark} />)}
    </div>
  );
}
