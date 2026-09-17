// «Моя карточка» внутри экрана паттерна: заполнена — показываем ответы и
// даём «Дополнить»/«Поделиться»; пусто — объясняем зачем и даём одну кнопку
// «Заполнить карточку» (правило онбординга: «откуда это и зачем» до действия,
// текст переиспользован из SchemaIntroSheet/ModeIntroSheet.explainer).
import { SectionLabel } from '../SectionLabel';
import { SharePill } from '../../share/SharePill';
import type { NoteCardField } from '../../../../shared/src/share/cards/noteCard';

interface Props {
  color: string;
  explainer: string;
  /** null — карточка ещё не заполнена (или заполнена целиком пустыми строками). */
  fields: NoteCardField[] | null;
  onEdit: () => void;
  onShare: () => void;
}

export function PatternCardSection({
  color,
  explainer,
  fields,
  onEdit,
  onShare,
}: Props) {
  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel>Моя карточка</SectionLabel>
      {fields ? (
        <div
          className="card"
          style={{
            borderRadius: 'var(--r-16)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-14)',
          }}
        >
          {fields.map((f) => (
            <div key={f.label}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  marginBottom: 4,
                }}
              >
                {f.label}
              </div>
              <div
                style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}
              >
                {f.text}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--r-16)',
            padding: '14px 16px',
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
          }}
        >
          {explainer}
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-10)', marginTop: 12 }}>
        <button
          onClick={onEdit}
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 'var(--r-14)',
            border: 'none',
            fontFamily: 'inherit',
            background: fields ? 'var(--surface-2)' : color,
            color: fields ? 'var(--text)' : '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {fields ? 'Дополнить' : 'Заполнить карточку'}
        </button>
        {fields && <SharePill onClick={onShare} />}
      </div>
    </div>
  );
}
