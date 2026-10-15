// Кнопка «Запросить тест на схемы» в карточке клиента (оба фронтенда).
// Аудит 2026-10: на каждый тап уходил новый запрос, а клиент получал пять
// одинаковых сообщений в личку. Webapp блокировал кнопку только ПОСЛЕ ответа
// (пока запрос в полёте она жалась), мини-апп не блокировал вообще. Хук
// держит защиту в одном месте: пока запрос в полёте, повторный вызов — no-op
// (ref, а не state: два тапа в одном кадре видят один и тот же рендер).
// Дедуп на сервере (src/therapy/ysq-request.ts) — основной рубеж, это второй.
import { useEffect, useRef, useState } from 'react';

const SENT_MS = 3000;
export const YSQ_REQUEST_ERROR = 'Не удалось отправить запрос';

export function useYsqRequest<Id>(
  clientId: Id | null | undefined,
  send: (clientId: Id) => Promise<unknown>,
) {
  const [ysqRequested, setYsqRequested] = useState(false);
  const [ysqError, setYsqError] = useState('');
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function resetYsq() {
    clearTimeout(timer.current);
    setYsqRequested(false);
    setYsqError('');
  }

  async function handleRequestYsq() {
    if (clientId == null || inFlight.current) return;
    inFlight.current = true;
    setYsqError('');
    try {
      await send(clientId);
      setYsqRequested(true);
      timer.current = setTimeout(() => setYsqRequested(false), SENT_MS);
    } catch {
      setYsqError(YSQ_REQUEST_ERROR);
    } finally {
      inFlight.current = false;
    }
  }

  return {
    ysqRequested,
    ysqError,
    setYsqRequested,
    resetYsq,
    handleRequestYsq,
  };
}
