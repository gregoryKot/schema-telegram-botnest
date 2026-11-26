import { useEffect, useState } from 'react';
import type { FormerTherapistInfo } from './formerTherapist';

// Загрузка бывшего терапевта для сообщения вместо «Мой терапевт» (оба
// фронтенда). `enabled` — «текущего терапевта нет» (связь загружена и пуста);
// пока false, запроса нет и ответ null. Спиннера нет: до ответа сообщения
// просто нет, сбой — тоже ничего (данные только реальные).
export function useFormerTherapist(
  load: () => Promise<FormerTherapistInfo | null>,
  enabled: boolean,
): FormerTherapistInfo | null {
  const [info, setInfo] = useState<FormerTherapistInfo | null>(null);
  // Терапевт снова подключён и отключён: прежний ответ не показываем, пока не
  // пришёл новый (сброс во время рендера, а не в эффекте).
  const [seen, setSeen] = useState(enabled);
  if (seen !== enabled) {
    setSeen(enabled);
    setInfo(null);
  }
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    // Через Promise.resolve: синхронный сбой load — тоже «ничего», не краш экрана.
    Promise.resolve()
      .then(load)
      .then((r) => {
        if (alive) setInfo(r?.name === undefined ? null : r);
      })
      .catch(() => {
        if (alive) setInfo(null);
      });
    return () => {
      alive = false;
    };
  }, [enabled, load]);
  return enabled ? info : null;
}
