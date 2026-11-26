import { THERAPIST_MODE_KEY } from '../../utils/storageKeys';

// Единственный писатель кэша стартового режима сайта ('1' — кабинет, '0' — клиент):
// зеркало серверного therapistMode (api.setTherapistView / api.getUserFlags).
// Остальные места зовут cacheTherapistMode, а не localStorage.setItem напрямую.

export function cacheTherapistMode(on: boolean): void {
  localStorage.setItem(THERAPIST_MODE_KEY, on ? '1' : '0');
}

/** null — режим на этом устройстве ещё не выбирали. */
export function readTherapistMode(): boolean | null {
  const value = localStorage.getItem(THERAPIST_MODE_KEY);
  return value === null ? null : value !== '0';
}
