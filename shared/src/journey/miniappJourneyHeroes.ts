// Герои «Моего пути» мини-аппа — градиентный JourneyHero; передаются в
// JourneyView пропсом `heroes` (journeyHeroes.ts). Сайт передаёт свою
// editorial-вёрстку (webapp/src/components/journey/webJourneyHeroes.ts).
import type { JourneyHeroes } from './journeyHeroes';
import { JourneyEmptyHero, JourneyHero } from './JourneyHero';

export const MINIAPP_JOURNEY_HEROES: JourneyHeroes = {
  Hero: JourneyHero,
  EmptyHero: JourneyEmptyHero,
};
