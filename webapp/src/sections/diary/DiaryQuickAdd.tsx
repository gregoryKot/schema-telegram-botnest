import type { DiaryType } from '../../types';
import { pressable } from '../../utils/a11y';
import { DIARY_HUE, hueStyle } from '../../lib/tone';

const CARDS: { type: DiaryType; eyebrow: string; title: string; desc: string; foot: string }[] = [
  { type: 'schema', eyebrow: 'Дневник схем', title: 'Записать момент', desc: 'Триггер · чувства · мысли · схема · здоровый взгляд', foot: '8–15 мин' },
  { type: 'mode', eyebrow: 'Дневник режимов', title: 'Записать режим', desc: 'Кто взял управление, что включило, что было нужно', foot: '5–10 мин' },
  { type: 'gratitude', eyebrow: 'Благодарность', title: 'Три вещи', desc: 'За что есть благодарность сегодня. Даже самое маленькое', foot: '2–5 мин' },
];

// Три крупные карточки «быстро записать» — каждая открывает поток создания записи своего типа.
export function DiaryQuickAdd({ onOpen }: { onOpen: (type: DiaryType) => void }) {
  return (
    <div className="cd-quick">
      {CARDS.map(c => (
        <div key={c.type} className="cd-quick-card tone-tint" style={hueStyle(DIARY_HUE[c.type])} {...pressable(() => onOpen(c.type))}>
          <div className="cd-quick-eyebrow">{c.eyebrow}</div>
          <div className="cd-quick-title">{c.title}</div>
          <div className="cd-quick-desc">{c.desc}</div>
          <div className="cd-quick-foot"><b>+ записать</b><span>{c.foot}</span></div>
        </div>
      ))}
    </div>
  );
}
