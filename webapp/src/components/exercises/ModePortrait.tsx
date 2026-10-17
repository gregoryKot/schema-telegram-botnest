// Портрет режима: 8 содержательных блоков перед вопросами карточки (правило
// онбординга CLAUDE.md — сначала «откуда это и зачем», потом действие).
// Состав блоков общий с мини-аппом (shared/src/mode/modePortraitSections.ts,
// правило №3). Презентационный компонент — card уже резолвлен родителем
// (ModeEx в FlashcardEx.tsx), чтобы не тянуть сюда реестр modeCards напрямую.
import { buildModePortraitSections } from '../../../../shared/src/mode/modePortraitSections';
import type { ModeCard } from '../../../../shared/src/mode/modeCards';
import { hueStyle } from '../../lib/tone';

interface Props {
  card: ModeCard;
  /** Оттенок группы режима (MODE_GROUP_HUE). */
  hue: number;
  onStart: () => void;
  /** Текст кнопки — иначе первичное «Заполнить свою карточку →». При
   *  возврате к портрету с экрана вопросов передавай честную формулировку
   *  про возврат, а не про начало (кнопка не должна врать про действие). */
  ctaLabel?: string;
}

export function ModePortrait({ card, hue, onStart, ctaLabel }: Props) {
  const sections = buildModePortraitSections(card);
  return (
    <div>
      <div className="ds-card ex2-portrait" style={hueStyle(hue)}>
        {sections.map((s) => (
          <div key={s.key} className="ex2-portrait-row">
            <div className="ds-label tone-ink">{s.label}</div>
            <div className="ex2-body-text">{s.text}</div>
          </div>
        ))}
      </div>
      <button className="ds-btn ex2-portrait-cta" onClick={onStart}>
        {ctaLabel ?? 'Заполнить свою карточку →'}
      </button>
    </div>
  );
}
