// Герой «Моего пути» мини-аппа — градиентный JourneyHero. Регистрируется
// из JourneySheet мини-аппа; сайт регистрирует свою editorial-вёрстку
// (webapp/src/components/journey/WebJourneyHeroes.tsx), так что каждая
// площадка бандлит только свою (journeyHeroes.ts).
import { journeyHeroes } from './journeyHeroes';
import { JourneyEmptyHero, JourneyHero } from './JourneyHero';

export function registerMiniappJourneyHeroes(): void {
  Object.assign(journeyHeroes, {
    Hero: JourneyHero,
    EmptyHero: JourneyEmptyHero,
  });
}
