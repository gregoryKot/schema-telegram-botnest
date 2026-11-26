// Две строки «Если нужно больше», которых на десктопе нет в списке (там они — квадрат «Мне плохо» и отдельный
// блок «Помощь рядом»): карточка «Мне плохо» и «Мне очень плохо» с контактами помощи. Контакты раскрываются на месте
// одним касанием (правило №7: кризисный путь не прячется глубже одного нажатия), блок «Помощь рядом» тот же, что на десктопе.
// Вид (редизайн 2026-11, b12): обе строки — один лист бережной бумаги (роза CRISIS_HUE = ENTITY_LOOK.sos),
// знак Heart — один на лист, колонкой слева на высоту обеих строк (пустой слот у второй строки читался
// незагрузившейся иконкой, ревью g4); раскрытие — внутри того же листа, под строками, во всю ширину.
import { useState, type CSSProperties } from 'react';
import { pressable } from '../../utils/a11y';
import { Heart } from '../../components/art/PaperArtSigns';
import { CrisisBlock } from './CrisisBlock';
import { CRISIS_HUE } from '../../../../shared/src/components/crisisCardStyle';
import { FLASHCARD_SUB, FLASHCARD_TITLE } from '../../../../shared/src/flashcard/flashcardNames';
import { glue } from '../../../../shared/src/utils/typo';

/** id раскрытого блока «Помощь рядом»: на него указывает aria-controls строки «Мне очень плохо». */
export const HELP_BLOCK_ID = 'practice-help-nearby';
const SOS_PAPER = { '--h': CRISIS_HUE } as CSSProperties;

// Без onSteps (пункт «Мне плохо» скрыт в «Инструментах») строки нет; «Мне очень плохо» — всегда.
export function PhoneHelpRows({ onSteps }: { onSteps?: () => void }) {
  const [crisisOpen, setCrisisOpen] = useState(false);
  const cls = 'pp-paper cr-rows' + (onSteps ? '' : ' cr-rows--one') + (crisisOpen ? ' is-open' : '');
  return (
    <div className={cls} style={SOS_PAPER}>
      <span className="pp-row-art cr-rows-art" aria-hidden="true"><Heart size="row" /></span>
      {onSteps && (
        <div className="cr-row" {...pressable(onSteps)}>
          <div className="cr-row-body">
            <div className="ds-list-title">{FLASHCARD_TITLE}</div>
            <div className="ds-sub">{glue(FLASHCARD_SUB)}</div>
          </div>
          <span className="ds-chev" aria-hidden="true" />
        </div>
      )}
      <div className="cr-row" aria-expanded={crisisOpen} aria-controls={crisisOpen ? HELP_BLOCK_ID : undefined}
        {...pressable(() => setCrisisOpen(v => !v))}>
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
