// Один шаг разбора: одна примета критика, два варианта ответа — «забота» или
// «критик». Одно очевидное действие на экран (правило онбординга). Логика
// вопросов (что спрашивать, чем отличаются варианты) — shared/src/phraseCheck,
// эта вёрстка — только webapp-стиль (правило: логику не копируем, верстаем
// заново в стиле фронтенда).
import { PHRASE_CRITERIA, type PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';
import { hueStyle } from '../../../lib/tone';
import { HUE_STRAIN, HUE_CARE } from '../exHue';

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
      <div className="ex2-prompt">
        <div className="ex2-prompt-num">{String(index + 1).padStart(2, '0')}</div>
        <div>
          <div className="ex2-prompt-hint">
            Примета {index + 1} из {total} · «{phrase}»
          </div>
          <div className="ex2-prompt-label ex2-prompt-label--sm">{c.question}</div>
        </div>
      </div>
      <div className="ex2-stack">
        <button className="ex2-choice" style={hueStyle(HUE_CARE)} onClick={() => onAnswer(c.id, false)}>
          {c.care}
        </button>
        <button className="ex2-choice" style={hueStyle(HUE_STRAIN)} onClick={() => onAnswer(c.id, true)}>
          {c.critic}
        </button>
      </div>
      <p className="ds-sub ex2-gap">{c.why}</p>
    </>
  );
}
