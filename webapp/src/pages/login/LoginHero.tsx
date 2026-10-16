import { DOMAIN_HUE, hueStyle } from '../../lib/tone';

// Доли сегментов полосы — по макету.
const SPAN: Record<string, number> = { rejection: 3, autonomy: 2, limits: 1, other_directed: 2, vigilance: 2 };

// Тёмная панель входа: знак, слоган и полоса из пяти доменов схем. Обращения
// к читателю в тексте нет: экран показывается до входа, формы ты/вы ещё нет.
export function LoginHero() {
  return (
    <aside className="al-hero">
      <div className="al-brand">
        <div className="al-logo">В</div>
        <span className="al-brand-name">Всё по схеме</span>
      </div>
      <div className="al-pitch">
        <h2 className="al-slogan">
          От «что со мной не так» к <i>«какая схема включилась»</i>
        </h2>
        <p className="al-lead">Инструмент схема-терапии для работы с мыслями, эмоциями и паттернами</p>
      </div>
      <div className="al-strip" aria-hidden="true">
        {Object.entries(DOMAIN_HUE).map(([id, hue]) => (
          <span key={id} className="tone-fill" style={{ ...hueStyle(hue), flex: SPAN[id] ?? 1 }} />
        ))}
      </div>
    </aside>
  );
}
