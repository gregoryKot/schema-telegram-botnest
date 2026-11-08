import '../../styles/client-practice.css';
import { pressable } from '../../utils/a11y';
import { Breath } from '../../components/art/PaperArt';
import { Heart, Talk } from '../../components/art/PaperArtSigns';
import { FLASHCARD_SUB, FLASHCARD_TITLE } from '../../../../shared/src/flashcard/flashcardNames';
import { scrollToBlock } from './scrollToBlock';

export const HERE_BLOCK_ID = 'practice-here-and-now';
export const HELP_BLOCK_ID = 'practice-help-nearby';

/** Верхний ряд «Практики»: «Мне плохо» (флешкарта; скрыта в «Инструментах» — нет onCrisis) и переходы ниже. */
export function PracticeTopRow({ onCrisis }: { onCrisis?: () => void }) {
  return (
    <div className="cp-top">
      {onCrisis && (
        <div className="ds-card ds-card--crisis ds-card--hover cp-top-card" {...pressable(onCrisis)}>
          <Heart size="row" /><div className="ds-h3">{FLASHCARD_TITLE}</div>
          <div className="ds-sub">{FLASHCARD_SUB}</div>
          <div className="ds-link cp-top-go">Начать →</div>
        </div>
      )}
      <div className="ds-card ds-card--hover cp-top-card" {...pressable(() => scrollToBlock(HERE_BLOCK_ID))}>
        <Breath size="row" /><div className="ds-label">Здесь и сейчас</div>
        <div className="cp-top-line">Дыхание 4-4-6</div>
        <div className="cp-top-line">Заземление 5-4-3-2-1</div>
        <div className="cp-top-line">Техника «Стоп»</div>
      </div>
      <div className="ds-card ds-card--hover cp-top-card" {...pressable(() => scrollToBlock(HELP_BLOCK_ID))}>
        <Talk size="row" /><div className="ds-label">Помощь рядом</div>
        <div className="cp-top-text">Если есть угроза жизни — 112. Телефон доверия и кризисные контакты — ниже.</div>
      </div>
    </div>
  );
}
