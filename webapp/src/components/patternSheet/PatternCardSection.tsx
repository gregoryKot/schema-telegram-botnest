// «Моя карточка» внутри экрана паттерна: заполнена — ответы и кнопки
// «Дополнить»/«Поделиться»; пусто — объяснение «откуда и зачем» и одна кнопка
// «Заполнить карточку» (правило онбординга). Парный по смыслу с
// schema-miniapp/src/components/patternSheet/PatternCardSection.tsx.
import { Skeleton } from '../Skeleton';
import type { NoteCardField } from '../../../../shared/src/share/cards/noteCard';

interface Props {
  explainer: string;
  /** null — карточка ещё не заполнена (или заполнена целиком пустыми строками). */
  fields: NoteCardField[] | null;
  /** Заметки ещё грузятся: вместо «пусто» показываем силуэт, а не выдуманное состояние. */
  loading?: boolean;
  onEdit: () => void;
  onShare: () => void;
}

export function PatternCardSection({ explainer, fields, loading, onEdit, onShare }: Props) {
  if (loading) {
    return (
      <section className="ps-block" aria-busy="true">
        <div className="ds-label">Моя карточка</div>
        <Skeleton height={120} radius={20} />
      </section>
    );
  }
  return (
    <section className="ps-block">
      <div className="ds-label">Моя карточка</div>
      {fields ? (
        <div className="ds-card ps-card">
          {fields.map((f) => (
            <div key={f.label}>
              <div className="ps-field-label">{f.label}</div>
              <div className="ps-field-text">{f.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ds-card ps-explainer">{explainer}</div>
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
