import { journeyHeroes } from '../../../../shared/src/journey/journeyHeroes';
import { WebJourneyEmptyHero, WebJourneyHero } from './WebJourneyHeroes';

/** Вызывается из App.tsx один раз на старте (shared/journey/journeyHeroes.ts). */
export function registerWebJourneyHeroes(): void {
  Object.assign(journeyHeroes, {
    Hero: WebJourneyHero,
    EmptyHero: WebJourneyEmptyHero,
  });
}
