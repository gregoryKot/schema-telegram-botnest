// Кнопка «Запросить тест на схемы» в карточке клиента (оба фронтенда).
// Аудит 2026-10: на каждый тап уходил новый запрос, а клиент получал пять
// одинаковых сообщений в личку. Webapp блокировал кнопку только ПОСЛЕ ответа
// (пока запрос в полёте она жалась), мини-апп не блокировал вообще. Хук
// держит защиту в одном месте: пока запрос в полёте, повторный вызов — no-op
// (ref, а не state: два тапа в одном кадре видят один и тот же рендер).
// Дедуп на сервере (src/therapy/ysq-request.ts) — основной рубеж, это второй.
// Защита привязана к клиенту: при смене clientId запрос в полёте у прежнего
// клиента отпускает флаг, а его поздний ответ игнорируется (иначе тап на новой
// карточке молча терялся, а «✓ Запрос отправлен» всплывал не на той карточке).
// QA 2026-11: «✓ Запрос отправлен» гас через 3 с и пропадал после
// перезагрузки, хотя запрос висел на сервере, а повтор был no-op дедупа.
// Теперь отправленный держится до смены клиента, а висящий на сервере
// (`serverPending` — ysqRequestPending из данных клиента) виден и после F5.
import { useEffect, useRef, useState } from 'react';

export const YSQ_REQUEST_ERROR = 'Не удалось отправить запрос';

export function useYsqRequest<Id>(
  clientId: Id | null | undefined,
  send: (clientId: Id) => Promise<unknown>,
  serverPending = false,
) {
  const [sent, setYsqRequested] = useState(false);
  const [ysqError, setYsqError] = useState('');
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    inFlight.current = false;
  }, [clientId]);

  function resetYsq() {
    setYsqRequested(false);
    setYsqError('');
  }

  async function handleRequestYsq() {
    if (clientId == null || inFlight.current) return;
    inFlight.current = true;
    const mine = generation.current;
    setYsqError('');
    try {
      await send(clientId);
      if (mine === generation.current) setYsqRequested(true);
    } catch {
      if (mine === generation.current) setYsqError(YSQ_REQUEST_ERROR);
    } finally {
      if (mine === generation.current) inFlight.current = false;
    }
  }

  return {
    ysqRequested: sent || serverPending,
    ysqError,
    setYsqRequested,
    resetYsq,
    handleRequestYsq,
  };
}
