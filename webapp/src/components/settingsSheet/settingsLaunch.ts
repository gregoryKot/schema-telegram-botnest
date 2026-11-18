import { useCallback, useEffect, useState } from 'react';
import { scrollIntoViewSafe } from '../../../../shared/src/utils/scrollIntoView';

// «Открыть «Настройки» на разделе» снаружи листа (общий поиск, settingsRows.ts). Запрос живёт в модуле:
// лист грузится лениво и узнаёт настройки позже запроса — раздел он забирает сам, ровно один раз.

/** Раздел (id из settingsNav.ts), к которому прокрутить открывшийся лист; null — лист с начала. */
let pending: string | null = null;
const listeners = new Set<() => void>();

/** Попросить AppShell открыть «Настройки»; sectionId — раздел, к которому прокрутить. */
export function requestSettingsOpen(sectionId: string | null): void {
  pending = sectionId;
  listeners.forEach((l) => l());
}

const scrollToSection = (id: string) => scrollIntoViewSafe(document.getElementById(id), { block: 'start' });

/** Открыт ли лист «Настройки» (useOverlays.ts): запрос снаружи открывает, закрытие сбрасывает раздел. */
export function useSettingsOpen(): [boolean, (on: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onRequest = () => setOpen(true);
    listeners.add(onRequest);
    return () => { listeners.delete(onRequest); };
  }, []);
  const set = useCallback((on: boolean) => {
    if (!on) pending = null;
    setOpen(on);
  }, []);
  return [open, set];
}

/** Прокрутка листа к разделу; `ready` — разделы уже на экране: ожидающий раздел забирается один раз. */
export function useSettingsScroll(ready: boolean): (id: string) => void {
  useEffect(() => {
    if (!ready) return;
    const take = () => {
      const id = pending;
      pending = null;
      if (id) scrollToSection(id);
    };
    listeners.add(take);
    take();
    return () => { listeners.delete(take); };
  }, [ready]);
  return scrollToSection;
}
