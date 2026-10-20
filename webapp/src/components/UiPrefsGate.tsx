import type { ReactNode } from 'react';
import { loadSettingsShared } from '../utils/settingsRequest';
import {
  syncFromServer,
  resetUiPrefsSync,
} from '../utils/uiPrefsSync';
import { useUiPrefsStartupSync } from '../utils/useUiPrefsStartupSync';

/**
 * Не пускает экраны кабинета, пока настройки экранов с сервера не применены к
 * localStorage: «Сегодня», «+» и остальные читают его при монтировании, и без
 * этого человек, настроивший экран в мини-аппе, видел бы на сайте дефолт.
 * Заставка та же, что у проверки входа, — один непрерывный экран загрузки.
 */
export function UiPrefsGate({ children }: { children: ReactNode }) {
  const settled = useUiPrefsStartupSync({
    load: loadSettingsShared,
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
