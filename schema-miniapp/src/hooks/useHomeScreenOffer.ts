import { useHomeScreenOfferState } from '../../../shared/src/host/useHomeScreenOffer';
import { api } from '../api';

export type OfferSurface = 'onboarding' | 'today' | 'settings';

const track = (name: string, meta: Record<string, string>) =>
  api.trackEvent(name, meta);

// Предложение «добавить значок на экран» — одно на все места показа (шаг
// онбординга, карточка-напоминание, настройки). Ядро общее с сайтом — shared.
export const useHomeScreenOffer = (surface: OfferSurface) =>
  useHomeScreenOfferState(surface, track);
