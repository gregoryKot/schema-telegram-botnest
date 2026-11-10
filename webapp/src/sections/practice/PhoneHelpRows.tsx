// Две строки «Если нужно больше», которых на десктопе нет в списке (там они —
// карточки верхнего ряда и отдельный блок «Помощь рядом»): карточка
// «Мне плохо» и «Мне очень плохо» с контактами помощи. Контакты раскрываются
// на месте одним касанием (правило №7: кризисный путь не прячется глубже
// одного нажатия), блок «Помощь рядом» тот же, что на десктопе.
// Вид (редизайн 2026-11, b12): обе строки — один лист бережной бумаги (роза 25, ENTITY_LOOK.sos),
// знак Heart — один на лист, у первой строки; раскрытие — внутри того же листа, под строкой, без
// заголовка-клина между строкой и карточкой («Помощь рядом» — надписью внутри): связь «нажал —
// раскрылось» видна по бумаге.
import { useState, type CSSProperties } from 'react';
import { pressable } from '../../utils/a11y';
import { Heart } from '../../components/art/PaperArtSigns';
import { CrisisBlock } from './CrisisBlock';
import { HELP_BLOCK_ID } from './PracticeTopRow';
import { FLASHCARD_SUB, FLASHCARD_TITLE } from '../../../../shared/src/flashcard/flashcardNames';

const SOS_PAPER = { '--h': 25 } as CSSProperties;

/** Слот знака строки: знак — только у первой строки листа, у второй — пустое место того же размера. */
function RowSign({ on }: { on: boolean }) {
  return <span className="pp-row-art cr-row-art" aria-hidden="true">{on && <Heart size="row" />}</span>;
}

// Без onSteps (пункт «Мне плохо» скрыт в «Инструментах») строки нет; «Мне очень плохо» — всегда.
export function PhoneHelpRows({ onSteps }: { onSteps?: () => void }) {
  const [crisisOpen, setCrisisOpen] = useState(false);
  return (
    <div className={'pp-paper cr-rows' + (crisisOpen ? ' is-open' : '')} style={SOS_PAPER}>
      {onSteps && (
        <div className="cr-row" {...pressable(onSteps)}>
          <RowSign on />
          <div className="cr-row-body">
            <div className="ds-list-title">{FLASHCARD_TITLE}</div>
            <div className="ds-sub">{FLASHCARD_SUB}</div>
          </div>
          <span className="ds-chev" aria-hidden="true" />
        </div>
      )}
      <div className="cr-row" aria-expanded={crisisOpen} {...pressable(() => setCrisisOpen(v => !v))}>
        <RowSign on={!onSteps} />
        <div className="cr-row-body">
          <div className="ds-list-title">Мне очень плохо</div>
          <div className="ds-sub">контакты помощи прямо сейчас</div>
        </div>
        <span className="ds-chev cr-chev" aria-hidden="true" />
      </div>
      {crisisOpen && <div id={HELP_BLOCK_ID} className="cr-open"><CrisisBlock inset /></div>}
    </div>
  );
}
