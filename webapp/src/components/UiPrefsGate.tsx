import type { ReactNode } from 'react';
import { api } from '../api';
import {
  syncFromServer,
  resetUiPrefsSync,
} from '../utils/uiPrefsSync';
import { useUiPrefsStartupSync } from '../utils/useUiPrefsStartupSync';

/**
 * Не пускает экраны кабинета, пока настройки экранов с сервера не применены к
 * localStorage (экраны читают его при монтировании). Заставка — как у входа.
 */
// Стабильная ссылка: новая стрелка на рендер перезапускала синхронизацию (GET + закрытый пуш).
const loadSettings = () => api.getSettings();
export function UiPrefsGate({ children }: { children: ReactNode }) {
  const settled = useUiPrefsStartupSync({
    load: loadSettings,
    sync: syncFromServer,
    reset: resetUiPrefsSync,
  });
  if (!settled) {
    return (
      <div className="loader-center">
        <div className="spinner" />
      </div>
    );
  }
  return <>{children}</>;
}
