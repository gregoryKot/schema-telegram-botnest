// Герой «Моего пути» (b22-journey): лист неба 240 — сущность «Мой путь» (ENTITY_LOOK.journey) — со
// сценой SceneJourney (стопка листов растёт с числом шагов) и числом шагов Literata 64 из данных;
// «Поделиться лентой шагов» — тихая ссылка ShareLink (залитой кнопки на листе нет). Пусто — тот же
// лист со сценой ScenePathStart и подсказкой, с чего начать. На ≥1024 лист — колонкой разворота
// (pa-spread-side, journey.css). Связка с JourneyView — webJourneyKit.ts.
import type { JourneyEmptyHeroProps, JourneyHeroProps } from '../../../../shared/src/journey/journeyHeroes';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { SceneJourney, ScenePathStart } from '../art/AppScenesMore';
import { ShareLink } from '../../share/ShareLink';
import { glue } from '../../../../shared/src/utils/typo';
import '../../styles/sheet-diary.css';

const { hue } = ENTITY_LOOK.journey;

export function WebJourneyEmptyHero({ tr, explainer, onStart }: JourneyEmptyHeroProps) {
  return (
    <div className="pp-paper jr-hero jr-hero--empty" style={hueStyle(hue)}>
      <div className="jr-hero-scene" aria-hidden="true"><ScenePathStart hue={hue} /></div>
      <h2 className="jr-hero-title">{glue('Путь ещё впереди')}</h2>
      <p className="jr-hero-text">
        {glue(`${explainer} ${tr(
          'Начни с трекера или любого дневника — первый шаг появится здесь.',
          'Начните с трекера или любого дневника — первый шаг появится здесь.',
        )}`)}
      </p>
      {onStart && <button type="button" className="ds-btn ds-btn--lg jr-hero-cta" onClick={onStart}>Оценить день</button>}
    </div>
  );
}

export function WebJourneyHero({ total, explainer, onShareFeed }: JourneyHeroProps) {
  return (
    <div className="pp-paper jr-hero" style={hueStyle(hue)}>
      <div className="jr-hero-scene" aria-hidden="true"><SceneJourney count={total} hue={hue} /></div>
      <div className="ds-label jr-hero-label">{glue('Шагов заботы о себе')}</div>
      <div className="jr-hero-num">{total}</div>
      <p className="jr-hero-text">{glue(explainer)}</p>
      <div className="jr-hero-link"><ShareLink onClick={onShareFeed} label="Поделиться лентой шагов →" /></div>
    </div>
  );
}
