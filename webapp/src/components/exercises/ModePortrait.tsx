// Портрет режима: 8 содержательных блоков перед вопросами карточки (правило
// онбординга CLAUDE.md — сначала «откуда это и зачем», потом действие).
// Состав блоков общий с мини-аппом (shared/src/mode/modePortraitSections.ts,
// правило №3). Презентационный компонент — card уже резолвлен родителем
// (ModeEx в FlashcardEx.tsx), чтобы не тянуть сюда реестр modeCards напрямую.
import { buildModePortraitSections } from '../../../../shared/src/mode/modePortraitSections';
import type { ModeCard } from '../../../../shared/src/mode/modeCards';

interface Props {
  card: ModeCard;
  accentColor: string;
  onStart: () => void;
  /** Текст кнопки — иначе первичное «Заполнить свою карточку →». При
   *  возврате к портрету с экрана вопросов передавай честную формулировку
   *  про возврат, а не про начало (кнопка не должна врать про действие). */
  ctaLabel?: string;
}

export function ModePortrait({ card, accentColor, onStart, ctaLabel }: Props) {
  const sections = buildModePortraitSections(card);
  return (
    <div>
      {sections.map((s, i) => (
        <div
          key={s.key}
          style={{
            padding: '16px 0',
            borderBottom: i < sections.length - 1 ? '1px solid var(--line)' : 'none',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: accentColor, marginBottom: 6 }}>
            {s.label}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.6 }}>{s.text}</div>
        </div>
      ))}
      <button
        className="ex-btn ex-btn-primary"
        onClick={onStart}
        style={{ marginTop: 22, width: '100%', minHeight: 48 }}
      >
        {ctaLabel ?? 'Заполнить свою карточку →'}
      </button>
    </div>
  );
}
