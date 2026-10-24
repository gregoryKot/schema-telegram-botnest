import { useSyncExternalStore } from 'react';
import {
  hasInstallPrompt,
  promptInstall,
  subscribeInstallPrompt,
} from '../utils/pwaInstall';

// Нативный промпт установки PWA — одна подписка на пойманное событие для
// всех поверхностей (баннер кабинета, лендинг): одна механика — один хук.
export function useInstallPrompt(): {
  canPrompt: boolean;
  install: () => void;
} {
  const canPrompt = useSyncExternalStore(subscribeInstallPrompt, hasInstallPrompt);
  return { canPrompt, install: () => void promptInstall() };
}
