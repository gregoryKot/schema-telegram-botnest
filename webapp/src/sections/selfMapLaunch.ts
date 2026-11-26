import { useEffect, useState } from 'react';

// «Открыть «Карту себя»» снаружи «Ещё»: ссылка запуска `selfmap` из уведомления
// «Повторы недели» (useStartParam → EntryFlows). Запрос живёт в модуле: «Ещё»
// может смонтироваться позже запроса и забирает его ровно один раз (как tasksLaunch).
let pending = false;
const listeners = new Set<() => void>();

export function requestSelfMapOpen(): void {
  pending = true;
  listeners.forEach((l) => l());
}

/** Состояние «Карты себя» в «Ещё»: открывается и по кнопке, и запросом снаружи. */
export function useSelfMapLaunch(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onRequest = () => {
      if (!pending) return;
      pending = false;
      setOpen(true);
    };
    listeners.add(onRequest);
    onRequest(); // запрос пришёл до монтирования
    return () => { listeners.delete(onRequest); };
  }, []);
  return [open, setOpen];
}
