// Один шаг разбора: одна примета критика, два варианта ответа — «забота» или
// «критик». Одно очевидное действие на экран (правило онбординга). Логика
// вопросов (что спрашивать, чем отличаются варианты) — shared/src/phraseCheck,
// эта вёрстка — только webapp-стиль (правило: логику не копируем, верстаем
// заново в стиле фронтенда).
import type { CSSProperties } from 'react';
import { PHRASE_CRITERIA, type PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';

const BASE: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '14px 18px',
  borderRadius: 10,
  fontSize: 14.5,
  lineHeight: 1.5,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export function PhraseMarkStep({
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
      <div className="ex-prompt">
        <div className="ex-prompt-num">{String(index + 1).padStart(2, '0')}</div>
        <div>
          <div className="ex-prompt-hint" style={{ marginBottom: 4 }}>
            Примета {index + 1} из {total} · «{phrase}»
          </div>
          <div className="ex-prompt-label" style={{ fontSize: 26, marginBottom: 4 }}>
            {c.emoji} {c.question}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => onAnswer(c.id, false)}
          style={{
            ...BASE,
            background: 'color-mix(in srgb, var(--c-moss) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--c-moss) 28%, transparent)',
            color: 'var(--text)',
          }}
        >
          {c.care}
        </button>
        <button
          onClick={() => onAnswer(c.id, true)}
          style={{
            ...BASE,
            background: 'color-mix(in srgb, var(--c-rose) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--c-rose) 28%, transparent)',
            color: 'var(--text)',
          }}
        >
          {c.critic}
        </button>
      </div>
      <p className="text-sm muted" style={{ lineHeight: 1.55 }}>{c.why}</p>
    </>
  );
}
