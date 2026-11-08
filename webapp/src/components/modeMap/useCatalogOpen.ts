import { useState } from 'react';
import { readLocal, writeLocal } from '../../../../shared/src/utils/safeLocalStorage';

/** Ключ — только здесь (scripts/local-cache-baseline.json): удобство устройства, как ушко палитры `modemap_palette`. */
const KEY = 'modemap_catalog';

/**
 * Раскрыт ли каталог «Все режимы и схемы» в палитре холста. По умолчанию закрыт:
 * на карту почти всегда кладут режимы и схемы клиента. Выбор терапевта запоминается
 * на устройстве. У клиента без концептуализации (или если она не загрузилась) каталог
 * открыт, пока терапевт сам его не закроет: больше брать нечего.
 */
export function useCatalogOpen(clientEmpty: boolean): [boolean, () => void] {
  const [touched, setTouched] = useState<boolean | null>(null);
  const open = touched ?? (clientEmpty || readLocal(KEY) === '1');
  const toggle = () => {
    setTouched(!open);
    writeLocal(KEY, open ? '0' : '1');
  };
  return [open, toggle];
}
