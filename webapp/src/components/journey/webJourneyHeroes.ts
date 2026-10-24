import type { JourneyHeroes } from '../../../../shared/src/journey/journeyHeroes';
import { WebJourneyEmptyHero, WebJourneyHero } from './WebJourneyHero';

/** Герои «Моего пути» сайта — пропсом `heroes` в JourneyView. */
export const WEB_JOURNEY_HEROES: JourneyHeroes = {
  Hero: WebJourneyHero,
  EmptyHero: WebJourneyEmptyHero,
};
