import { FlashcardFrame } from './FlashcardFrame';
import { CrisisCard } from '../CrisisCard';
import { hueStyle } from '../../lib/tone';
import { GROUNDING_BREATHS as BREATHS } from '../../../../shared/src/flashcard/flashcardNames';

interface Props {
  tr: (ty: string, vy: string) => string;
  historyCount: number;
  onContinue: () => void;
  onHistory: () => void;
  onClose: () => void;
}

/** Первый экран: «Всё правильно» + три вдоха (ритм 4-4-6, как у практики дыхания). */
export function FlashcardGrounding({ tr, historyCount, onContinue, onHistory, onClose }: Props) {
  return (
    <FlashcardFrame onBack={onClose} label="Закрыть" center>
      <h1 className="ds-h2 sk-fc-hero">Всё правильно</h1>
      <p className="sk-fc-lead">
        {tr('То, что ты чувствуешь сейчас – это нормально.', 'То, что вы чувствуете сейчас – это нормально.')}<br />Это пройдёт.
      </p>
      {/* Телефоны доверия — на первом экране, без раскрытия и прокрутки (C-К1). */}
      <CrisisCard standing compact />
      <div className="ds-card sk-fc-breath tone-soft" style={hueStyle(240)}>
        <div className="sk-fc-breath-title tone-ink">Три вдоха прямо сейчас</div>
        {BREATHS.map((t, i) => (
          <div key={i} className="sk-fc-breath-row">
            <span className="ds-num sk-fc-dot tone-fill">{i + 1}</span>
            <span className="sk-fc-breath-text">{t}</span>
          </div>
        ))}
      </div>
      <p className="ds-sub sk-fc-feet">
        {tr('Почувствуй ноги на полу. Ты в безопасности.', 'Почувствуйте ноги на полу. Вы в безопасности.')}
      </p>
      <button onClick={onContinue} className="ds-btn sk-fc-wide">
        Стало чуть лучше – разобраться →
      </button>
      {historyCount > 0 && (
        <button onClick={onHistory} className="ds-btn ds-btn--secondary sk-fc-wide">
          История карточек ({historyCount})
        </button>
      )}
      <button onClick={onClose} className="ds-link sk-fc-quiet">
        Просто закрыть
      </button>
    </FlashcardFrame>
  );
}
