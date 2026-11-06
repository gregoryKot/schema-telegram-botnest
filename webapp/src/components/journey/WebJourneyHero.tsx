// Герой «Моего пути» для сайта — editorial-вёрстка: без градиента и эмодзи,
// слева, эйбрау + крупная serif-цифра + подпись между тонкими линиями.
// Мини-апп берёт градиентный JourneyHero (shared/journey/JourneyHero.tsx);
// общее — данные и пояснение, которые приходят пропсами из JourneyView.
// Связка героев — webJourneyHeroes.ts.
import type {
  JourneyEmptyHeroProps,
  JourneyHeroProps,
} from '../../../../shared/src/journey/journeyHeroes';
import { Cup } from '../art/PaperArt';
import '../../styles/sheet-diary.css';

export function WebJourneyEmptyHero({ tr, explainer }: JourneyEmptyHeroProps) {
  return (
    <div className="ds-card sd-hero pp-hero">
      <div className="pp-hero-body">
        <h2 className="ds-h2">Путь ещё впереди</h2>
        <p className="ds-sub sd-hero-text">
          {explainer}{' '}
          {tr(
            'Начни с трекера или любого дневника — первый шаг появится здесь.',
            'Начните с трекера или любого дневника — первый шаг появится здесь.',
          )}
        </p>
      </div>
      {/* Пусто — чашка, как у остальных пустых состояний (PaperEmpty). */}
      <Cup size="hero" />
    </div>
  );
}

export function WebJourneyHero({ total, explainer, onShareFeed }: JourneyHeroProps) {
  return (
    <div className="ds-card sd-hero">
      <div className="ds-eyebrow">Шагов заботы о себе</div>
      <div className="ds-num sd-hero-num">{total}</div>
      <p className="ds-sub sd-hero-text">{explainer}</p>
      <button onClick={onShareFeed} className="ds-link sd-hero-link">
        Поделиться лентой шагов →
      </button>
    </div>
  );
}
