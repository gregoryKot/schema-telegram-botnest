// Герой-блоки «Моего пути» приходят в JourneyView обязательным пропсом
// `heroes`, а не импортируются им: мини-апп передаёт градиентный JourneyHero,
// сайт — editorial-версию (webapp/src/components/journey/WebJourneyHero.tsx).
// Рантайм-диспетчер по variant втащил бы обе вёрстки в бандл каждой площадки;
// пропс без дефолта — каждая бандлит только свою, а забытая передача — ошибка
// tsc, а не пустой экран. Данные и расчёты (total, explainer) общие.
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
