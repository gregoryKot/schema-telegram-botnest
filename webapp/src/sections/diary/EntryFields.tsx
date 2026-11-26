// Поля раскрытой записи ленты «Записей» (b11): подпись строкой, текст под ней (пробелы склеены при отрисовке,
// glueSpaces — текст пользователя: дефисы и тире его, в данных всё прежнее), на компьютере — в две колонки. Ответ Здорового Взрослого — вставка HealthyVoice (та же, что пример
// в мастере режимов) на всю ширину: главный ответ записи виден сразу.
import { HealthyVoice } from '../../components/paper/HealthyVoice';
import { glueSpaces } from '../../../../shared/src/utils/typo';
import type { FieldRow } from './entryRows';

export function ExpandField({ label, text, mark }: { label: string; text: string; mark?: FieldRow[2] }) {
  if (mark === 'healthy') return <HealthyVoice label={label} text={glueSpaces(text)} className="cd-field cd-field--healthy" />;
  return (
    <div className="cd-field">
      <div className={'cd-field-label' + (mark === 'accent' ? ' is-accent' : '')}>{label}</div>
      <div className="cd-field-text">{glueSpaces(text)}</div>
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
