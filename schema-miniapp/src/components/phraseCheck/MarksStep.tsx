// Шаг разбора: четыре приметы по одной, у каждой два ответа — «забота» или
// «критик». Одно очевидное действие на экран (правило онбординга): вопрос,
// две кнопки, строка «зачем это».
import {
  PHRASE_CRITERIA,
  type PhraseMarkId,
} from '../../../../shared/src/phraseCheck/criteria';

const CHOICE: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '13px 14px',
  borderRadius: 'var(--r-14)',
  fontSize: 14,
  lineHeight: 1.45,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

export function MarksStep({
  index,
  total,
  phrase,
  onAnswer,
}: {
  index: number;
  total: number;
  phrase: string;
  /** critic=true — примета засчитана как голос критика */
  onAnswer: (id: PhraseMarkId, critic: boolean) => void;
}) {
  const c = PHRASE_CRITERIA[index];
  return (
    <>
      <div
        style={{
          background: 'rgba(var(--fg-rgb),0.04)',
          border: '1px solid rgba(var(--fg-rgb),0.08)',
          borderRadius: 'var(--r-14)',
          padding: '10px 14px',
          marginBottom: 14,
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--text-sub)',
        }}
      >
        «{phrase}»
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 6,
        }}
      >
        Примета {index + 1} из {total}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 12,
          lineHeight: 1.35,
        }}
      >
        {c.emoji} {c.question}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <button
          onClick={() => onAnswer(c.id, false)}
          style={{
            ...CHOICE,
            background:
              'color-mix(in srgb, var(--accent-green) 8%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent-green) 22%, transparent)',
            color: 'var(--text)',
          }}
        >
          {c.care}
        </button>
        <button
          onClick={() => onAnswer(c.id, true)}
          style={{
            ...CHOICE,
            background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent-red) 22%, transparent)',
            color: 'var(--text)',
          }}
        >
          {c.critic}
        </button>
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: 'var(--text-faint)',
          marginTop: 12,
        }}
      >
        {c.why}
      </div>
    </>
  );
}
