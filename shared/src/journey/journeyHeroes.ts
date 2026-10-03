// Герой-блоки «Моего пути» подставляет обёртка площадки, а не JourneyView.
// Раньше JourneyView импортировал JourneyHero напрямую, и сайт получал
// мини-аппную вёрстку (градиент, эмодзи, всё по центру). Рантайм-диспетчер
// по variant втащил бы обе вёрстки в бандл каждой площадки — поэтому вёрстку
// отдают через реестр: мини-апп кладёт JourneyHero, сайт — свою editorial-
// версию (webapp/src/components/journey/WebJourneyHeroes.tsx), и каждая
// площадка бандлит только свою. Данные и расчёты (total, explainer) остаются
// общими — они приходят пропсами из JourneyView. Реестр, а не React-контекст:
// провайдер с обёрткой стоил мини-аппу лишних байт, а регистрация нужна один
// раз на старте.
import type { ComponentType } from 'react';

export interface JourneyHeroProps {
  total: number;
  explainer: string;
  onShareFeed: () => void;
}

export interface JourneyEmptyHeroProps {
  tr: (ty: string, vy: string) => string;
  explainer: string;
}

export interface JourneyHeroes {
  Hero: ComponentType<JourneyHeroProps>;
  EmptyHero: ComponentType<JourneyEmptyHeroProps>;
}

const renderNothing = () => null;

/** Площадка один раз на старте делает Object.assign(journeyHeroes, {...});
 *  без этого JourneyView рисует тело экрана без шапки. */
export const journeyHeroes: JourneyHeroes = {
  Hero: renderNothing,
  EmptyHero: renderNothing,
};
