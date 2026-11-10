// «Моя карточка» внутри экрана паттерна: заполнена — ответы на белом листе с
// тенью-слоем тона паттерна и кнопки «Дополнить»/«Поделиться» одной строкой;
// пусто — объяснение «откуда и зачем» и одна кнопка «Заполнить карточку»
// (правило онбординга); заметки не загрузились — строка сбоя с «Повторить» и без
// «Заполнить»: пустой опросник поверх незагруженной карточки затёр бы сохранённое
// (сбой ≠ пусто, принцип 8 APP_2026-11.md, b15).
import { Skeleton } from '../Skeleton';
import { PaperAlert } from '../paper/PaperAlert';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import type { NoteCardField } from '../../../../shared/src/share/cards/noteCard';

interface Props {
  explainer: string;
  /** null — карточка ещё не заполнена (или заполнена целиком пустыми строками). */
  fields: NoteCardField[] | null;
  /** Заметки ещё грузятся: вместо «пусто» показываем силуэт, а не выдуманное состояние. */
  loading?: boolean;
  /** Заметки не загрузились: строка сбоя вместо «пусто». */
  failed?: boolean;
  /** Знак паттерна — бледно у строки сбоя. */
  sign?: SignKey;
  onRetry?: () => void;
  onEdit: () => void;
  onShare: () => void;
}

export function PatternCardSection({ explainer, fields, loading, failed, sign, onRetry, onEdit, onShare }: Props) {
  if (loading) {
    return (
      <section className="ps-block" aria-busy="true">
        <div className="ds-label ps-label">Моя карточка</div>
        <Skeleton height={120} radius={20} />
      </section>
    );
  }
  if (failed && !fields) {
    return (
      <section className="ps-block">
        <div className="ds-label ps-label">Моя карточка</div>
        <PaperAlert sign={sign} title="Карточка не загрузилась."
          text="Заполнить её можно после загрузки — чтобы новое не легло поверх сохранённого" onRetry={onRetry} />
      </section>
    );
  }
  return (
    <section className="ps-block">
      <div className="ds-label ps-label">Моя карточка</div>
      {fields ? (
        <div className="ps-card">
          {fields.map((f) => (
            <div key={f.label}>
              <div className="ds-label ps-field-label">{f.label}</div>
              <div className="ps-field-text">{f.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ps-card ps-explainer">{explainer}</div>
      )}
      <div className="ps-actions">
        <button className={fields ? 'ds-btn ds-btn--secondary' : 'ds-btn'} onClick={onEdit}>
          {fields ? 'Дополнить' : 'Заполнить карточку'}
        </button>
        {fields && (
          <button className="ds-btn ds-btn--secondary" onClick={onShare}>
            Поделиться
          </button>
        )}
      </div>
    </section>
  );
}
