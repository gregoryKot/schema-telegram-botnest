import { useHomeScreenOfferState } from '../../../shared/src/host/useHomeScreenOffer';
import { api } from '../api';

const track = (name: string, meta: Record<string, string>) => api.trackEvent(name, meta);

/** «Значок на экран» внутри Telegram: паритет с хуком мини-аппа (общее ядро в shared). */
export const useHomeScreenOffer = (surface: 'today') => useHomeScreenOfferState(surface, track);
