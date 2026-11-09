import { useEffect, type ReactNode } from 'react';
import { api } from '../api';
import {
  syncFromServer,
  resetUiPrefsSync,
  flushUiPrefs,
} from '../utils/uiPrefsSync';
import { useUiPrefsStartupSync } from '../utils/useUiPrefsStartupSync';
import { onPageLeave } from '../../../shared/src/utils/pageLeave';
import { GateSkeleton } from './AuthGateViews';

/**
 * Не пускает экраны кабинета, пока настройки экранов с сервера не применены к
 * localStorage (экраны читают его при монтировании). Пока ждём — силуэт экрана, как у входа (AuthGateViews).
 */
// Стабильная ссылка: новая стрелка на рендер перезапускала синхронизацию (GET + закрытый пуш).
const loadSettings = () => api.getSettings();
export function UiPrefsGate({ children }: { children: ReactNode }) {
  const settled = useUiPrefsStartupSync({
    load: loadSettings,
    sync: syncFromServer,
    reset: resetUiPrefsSync,
  });
  // Настройку экрана, сделанную за секунду до закрытия вкладки или мини-аппа,
  // досылаем сразу, а не через окно debounce (#922): другое устройство видит её
  // раньше. Не дошла — досылает следующий старт (маркер в uiPrefsSync).
  useEffect(() => onPageLeave(flushUiPrefs), []);
  if (!settled) return <GateSkeleton />;
  return <>{children}</>;
}
