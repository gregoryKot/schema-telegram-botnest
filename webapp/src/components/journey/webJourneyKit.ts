import { createElement } from 'react';
import type { JourneyKit } from '../../../../shared/src/journey/journeyKit';
import type { JourneyDetailArt } from '../../../../shared/src/journey/JourneyItemDetail';
import { SignChip } from '../paper/SignChip';
import { WebJourneyEmptyHero, WebJourneyHero } from './WebJourneyHero';
import { JourneyDetailHead, JourneyRowSign, JourneyStat, JourneyVoice } from './JourneySigns';

/** Вёрстка «Моего пути» сайта — пропсом `kit` в JourneyView. */
export const WEB_JOURNEY_KIT: JourneyKit = {
  Hero: WebJourneyHero, EmptyHero: WebJourneyEmptyHero, Stat: JourneyStat, Chip: SignChip,
  rowArt: (item) => createElement(JourneyRowSign, { item }),
};
/** Шапка детали со знаком и голос Здорового Взрослого — пропсом `art` в JourneyItemDetail. */
export const JOURNEY_DETAIL_ART: JourneyDetailArt = {
  head: (item, label, line) => createElement(JourneyDetailHead, { item, label, line }),
  voice: (title, text) => createElement(JourneyVoice, { title, text }),
};
