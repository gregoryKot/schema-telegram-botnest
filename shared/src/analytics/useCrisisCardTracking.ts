import { useEffect } from 'react';

type Track = (name: string, meta?: Record<string, unknown>) => void;

/**
 * Аналитика кризисной карточки — общая логика обоих фронтендов (правило №3):
 * фиксирует показ (crisis_card_shown) и возвращает обработчик нажатия на
 * телефон доверия (crisis_hotline_tapped). Без свободного текста — только
 * surface (экран, правило №7). Событие/метрика — правило №8.
 *
 * Трекинг работает ТОЛЬКО когда передан surface: он маркирует карточку,
 * вызванную детекцией кризиса в тексте (дневники). Постоянная карточка помощи
 * (напр. в разделе «Помощь», без surface) метрику не засоряет — иначе «показов»
 * было бы столько же, сколько открытий экрана.
 */
export function useCrisisCardTracking(
  surface: string | undefined,
  track: Track,
): () => void {
  useEffect(() => {
    if (surface) track('crisis_card_shown', { surface });
  }, [surface, track]);
  return () => {
    if (surface) track('crisis_hotline_tapped', { surface });
  };
}
