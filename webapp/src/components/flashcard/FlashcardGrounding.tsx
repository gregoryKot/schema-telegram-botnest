import { FlashcardFrame } from './FlashcardFrame';
import { CrisisCard } from '../CrisisCard';
import { SceneSos } from '../art/SceneSos';
import { Breath } from '../art/PaperArt';
import { GROUNDING_BREATHS as BREATHS, FLASHCARD_TITLE } from '../../../../shared/src/flashcard/flashcardNames';

interface Props {
  tr: (ty: string, vy: string) => string;
  historyCount: number;
  onContinue: () => void;
  onHistory: () => void;
  onClose: () => void;
}

/** Первый экран: «Всё правильно» + три вдоха (ритм 4-4-6, как у практики дыхания).
 *  Вид (редизайн 2026-11, b12): тёплый лист розы со сценой SceneSos (сердце между дугами дыхания) —
 *  на ≥1024 разворотом слева; телефоны доверия сразу под ним (C-К1: без раскрытия и прокрутки) —
 *  на странице, без второй розовой бумаги и второго сердца; «Три вдоха» — блок между линиями со
 *  знаком Breath, а не голубая коробка с синими кружками (персик 45 рядом с розой 25 читался тем же
 *  розовым листом); одна залитая кнопка. */
export function FlashcardGrounding({ tr, historyCount, onContinue, onHistory, onClose }: Props) {
  const hero = (
    <section className="pp-paper sk-fc-hero">
      <div className="sk-fc-hero-art" aria-hidden="true"><SceneSos /></div>
      <span className="ds-label sk-fc-hero-label">{FLASHCARD_TITLE}</span>
      <h1 className="sk-fc-hero-title">Всё правильно</h1>
      <p className="sk-fc-lead">
        {tr('То, что ты чувствуешь сейчас – это нормально.', 'То, что вы чувствуете сейчас – это нормально.')}<br />Это пройдёт.
      </p>
    </section>
  );
  return (
    <FlashcardFrame onBack={onClose} label="Закрыть" side={hero}>
      {/* Телефоны доверия — на первом экране, без раскрытия и прокрутки (C-К1). */}
      <div className="sk-fc-help"><CrisisCard standing compact flat /></div>
      <div className="sk-fc-breath">
        <div className="sk-fc-breath-head">
          <Breath size="row" />
          <span className="sk-fc-breath-title">Три вдоха прямо сейчас</span>
        </div>
        <ol className="sk-fc-breath-list">
          {BREATHS.map((t, i) => (
            <li key={i} className="sk-fc-breath-row">
              <span className="sk-fc-breath-n" aria-hidden="true">{i + 1}</span>
              <span className="sk-fc-breath-text">{t}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="sk-fc-feet">
        {tr('Почувствуй ноги на полу. Ты в безопасности.', 'Почувствуйте ноги на полу. Вы в безопасности.')}
      </p>
      <button onClick={onContinue} className="ds-btn sk-fc-wide">
        Стало чуть лучше – разобраться →
      </button>
      <div className="sk-fc-links">
        {historyCount > 0 && (
          <button onClick={onHistory} className="ds-link sk-fc-quiet">
            История карточек ({historyCount})
          </button>
        )}
        <button onClick={onClose} className="ds-link sk-fc-quiet">
          Просто закрыть
        </button>
      </div>
    </FlashcardFrame>
  );
}
