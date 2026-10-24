// Персист последней открытой вкладки «Паттернов» (Схемы/Режимы/Потребности).
// SchemasSection размонтируется при уходе на другую вкладку нижней навигации
// и раньше всегда открывался заново на «Схемах» — забывая, где реально был
// пользователь (напр. «Паттерны → Режимы», ушёл в «Сегодня», вернулся).
import { PATTERNS_LAST_TAB_KEY } from '../../utils/storageKeys';
import type { Tab } from './types';

const VALID_TABS: readonly Tab[] = ['schemas', 'modes', 'needs'];

/** Битое/чужое значение в localStorage — не валит чтение, просто null
 *  (вызывающая сторона фолбэкает на 'schemas'). */
export function readStoredPatternsTab(): Tab | null {
  const v = localStorage.getItem(PATTERNS_LAST_TAB_KEY);
  return v && (VALID_TABS as readonly string[]).includes(v) ? (v as Tab) : null;
}

export function writeStoredPatternsTab(tab: Tab): void {
  localStorage.setItem(PATTERNS_LAST_TAB_KEY, tab);
}
