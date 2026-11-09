// Поля раскрытой записи ленты «Записей» (b11, diary-entry-expanded): подпись строкой и текст под ней,
// на компьютере — в две колонки. Ответ Здорового Взрослого («Здоровый взгляд» в дневнике схем,
// «Здоровый Взрослый» в дневнике режимов) — вставка мха со знаком группы «здоровые» (Together) на всю
// ширину: главный ответ записи виден сразу, а не только красной подписью среди равных полей.
import { modeGroupLook } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../../components/art/SignArt';
import { hueStyle } from '../../lib/tone';
import type { FieldRow } from './entryRows';

const HEALTHY = modeGroupLook('healthy');

export function ExpandField({ label, text, mark }: { label: string; text: string; mark?: FieldRow[2] }) {
  if (mark === 'healthy') return (
    <div className="pp-paper cd-field cd-field--healthy" style={hueStyle(HEALTHY.hue)}>
      <span className="cd-field-sign" aria-hidden="true"><SignArt sign={HEALTHY.sign} size="row" /></span>
      <div><div className="cd-field-label">{label}</div><div className="cd-field-text">{text}</div></div>
    </div>
  );
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
