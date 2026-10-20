import { api } from '../api';
import { useTodayCustomization as useSharedTodayCustomization } from '../../../shared/src/today/useTodayCustomization';
import { useLongPress } from '../../../shared/src/hooks/useLongPress';
import { notifyPrefsChanged } from '../utils/uiPrefsSync';

const track = (name: string, meta?: Record<string, unknown>) =>
  api.trackEvent(name, meta);

// Настройка экрана «Сегодня» — логика общая с сайтом
// (shared/today/useTodayCustomization: что показано, какая практика главная,
// порядок блоков). Здесь только транспорт мини-аппа (аналитика, синхронизация
// между устройствами через uiPrefsSync) и долгое нажатие на блок — быстрый
// путь к его настройке (см. useLongPress).
export function useTodayCustomization() {
  const today = useSharedTodayCustomization({
    track,
    onChanged: notifyPrefsChanged,
  });
  const { openByHold } = today;
  return {
    ...today,
    holdFocus: useLongPress(() => openByHold('practice')),
    holdStreak: useLongPress(() => openByHold('streak')),
    holdPhrase: useLongPress(() => openByHold('phrase')),
  };
}
