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
  /** «Паттерн недели» / вводная новичку (вкладка «Схемы» и десктоп). */
  hero: boolean;
  /** Подсказка сверху вкладки «Режимы» — только на телефоне: на десктопе верх общий. */
  modesHero: boolean;
  /** Выраженные схемы, тест YSQ, «Мои схемы», карта схем. */
  schemas: boolean;
  modes: boolean;
  needs: boolean;
}

export function visibleBlocks(tab: PatternsTab, mobile: boolean): PatternsBlocks {
  if (!mobile) return { hero: true, modesHero: false, schemas: true, modes: true, needs: true };
  return { hero: tab === 'schemas', modesHero: tab === 'modes', schemas: tab === 'schemas', modes: tab === 'modes', needs: tab === 'needs' };
}

/** Битое или недоступное хранилище — просто «Схемы». */
export function readStoredTab(): PatternsTab {
  try {
    const v = localStorage.getItem(PATTERNS_LAST_TAB_KEY);
    return PATTERNS_TABS.some(t => t.id === v) ? (v as PatternsTab) : 'schemas';
  } catch { return 'schemas'; }
}

/** false — хранилище недоступно (приватный режим): вкладка просто не запомнится. */
export function writeStoredTab(tab: PatternsTab): boolean {
  try {
    localStorage.setItem(PATTERNS_LAST_TAB_KEY, tab);
    return true;
  } catch {
    return false;
  }
}
