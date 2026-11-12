import { useIsMobile } from '../useIsMobile';

/**
 * Компактная шапка карточки клиента — только на вкладке «Графические карты» и только там, где есть
 * холст (компьютер, планшет): одна строка без статуса и «Встречи», высота уходит холсту
 * (docs/design/APP_2026-11.md, b34). Остальные вкладки и телефон — обычная шапка.
 */
export const isCompactHead = (tab: string, phone: boolean): boolean => !phone && tab === 'mode_map';

export function useClientHead(tab: string): { phone: boolean; headClass: string } {
  const phone = useIsMobile();
  return { phone, headClass: isCompactHead(tab, phone) ? 'tk-head tk-head--compact' : 'tk-head' };
}
