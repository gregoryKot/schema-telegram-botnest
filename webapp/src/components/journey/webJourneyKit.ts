import { createElement } from 'react';
import type { JourneyKit } from '../../../../shared/src/journey/journeyKit';
import type { JourneyDetailArt } from '../../../../shared/src/journey/JourneyItemDetail';
import { PaperAlert } from '../paper/PaperAlert';
import { SignChip } from '../paper/SignChip';
import { WebJourneyEmptyHero, WebJourneyHero } from './WebJourneyHero';
import { JourneyDetailHead, JourneyRowSign, JourneyStat, JourneyVoice } from './JourneySigns';

export const WEB_JOURNEY_KIT: JourneyKit = { // вёрстка «Моего пути» сайта — пропсом `kit` в JourneyView
  Hero: WebJourneyHero, EmptyHero: WebJourneyEmptyHero, Stat: JourneyStat, Chip: SignChip,
  Alert: ({ text, onRetry }) => createElement(PaperAlert, { title: text, sign: 'strokes', onRetry, retryLabel: 'Попробовать снова' }),
  rowArt: (item) => createElement(JourneyRowSign, { item }),
};
export const JOURNEY_DETAIL_ART: JourneyDetailArt = { // шапка детали со знаком и голос Здорового Взрослого — пропсом `art`
  head: (item, label, line) => createElement(JourneyDetailHead, { item, label, line }),
  voice: (title, text) => createElement(JourneyVoice, { title, text }),
};
