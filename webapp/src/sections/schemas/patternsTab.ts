// Вкладки «Паттернов» на телефоне (Схемы / Режимы / Потребности) и то, какие
// блоки в какой вкладке живут. На десктопе вкладок нет — виден весь экран.
import { PATTERNS_LAST_TAB_KEY } from '../../utils/storageKeys';

export type PatternsTab = 'schemas' | 'modes' | 'needs';

export const PATTERNS_TABS: readonly { id: PatternsTab; label: string }[] = [
  { id: 'schemas', label: 'Схемы' },
  { id: 'modes', label: 'Режимы' },
  { id: 'needs', label: 'Потребности' },
];

export interface PatternsBlocks {
  /** «Паттерн недели» / вводная новичку. */
  hero: boolean;
  /** Выраженные схемы, тест YSQ, «Мои схемы», карта схем. */
  schemas: boolean;
  modes: boolean;
  needs: boolean;
}

export function visibleBlocks(tab: PatternsTab, mobile: boolean): PatternsBlocks {
  if (!mobile) return { hero: true, schemas: true, modes: true, needs: true };
  return { hero: tab === 'schemas', schemas: tab === 'schemas', modes: tab === 'modes', needs: tab === 'needs' };
}

/** Битое или недоступное хранилище — просто «Схемы». */
export function readStoredTab(): PatternsTab {
  try {
    const v = localStorage.getItem(PATTERNS_LAST_TAB_KEY);
    return PATTERNS_TABS.some(t => t.id === v) ? (v as PatternsTab) : 'schemas';
  } catch { return 'schemas'; }
}

export function writeStoredTab(tab: PatternsTab): void {
  try { localStorage.setItem(PATTERNS_LAST_TAB_KEY, tab); } catch { /* приватный режим — вкладка не запоминается */ }
}
