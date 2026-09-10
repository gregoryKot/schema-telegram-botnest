import { useCallback, useState } from 'react';

export type DataExportStatus =
  'idle' | 'loading' | 'done' | 'error' | 'unsupported';

export interface DataExportDeps {
  /** Тот же authedFetch, что и у остального API-клиента фронта (Bearer/
   *  initData уже внутри) — экспорт не заводит свой транспорт. */
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const FALLBACK_FILENAME = 'schemehappens-export.json';

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  // Имя параметра сверяется целиком (правило №14: «Совпадение подстроки — не
  // проверка имени»), не поиском произвольной подстроки в заголовке.
  const match = /(?:^|;)\s*filename="([^"]+)"/i.exec(header);
  return match ? match[1] : null;
}

function canTriggerDownload(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return 'download' in document.createElement('a');
  } catch {
    return false;
  }
}

/**
 * Выгрузка своих данных (право на переносимость, 152-ФЗ ст.14 / GDPR
 * art.15,20) — общая логика обоих фронтендов (правило №3 CLAUDE.md).
 * Эндпоинт (`GET /api/account/export`) авторизованный, поэтому простой
 * `<a href>` не сработает — браузер не пошлёт заголовок. Поэтому:
 * fetch с авторизацией → Blob → object URL → клик по `<a download>` → revoke.
 *
 * В вебвью мессенджера клик по `<a download>` может молча не сработать —
 * браузер об этом не сообщает, единственный сигнал заранее — отсутствие
 * самого атрибута `download`. Оба исхода (нет атрибута ДО запроса, исключение
 * вокруг клика ПОСЛЕ) ведут в один и тот же статус `unsupported`: экран
 * обязан явно сказать «тут не получится», а не тихо притвориться успехом
 * (правило CLAUDE.md «Никаких хардкод-заглушек» — тот же принцип: не
 * настоящий результат не выдаётся за настоящий).
 */
export function useDataExport({ authedFetch }: DataExportDeps) {
  const [status, setStatus] = useState<DataExportStatus>('idle');

  const exportData = useCallback(async () => {
    if (!canTriggerDownload()) {
      setStatus('unsupported');
      return;
    }
    setStatus('loading');
    try {
      // Путь — строковый литерал прямо в вызове (не вынесен в константу):
      // гейт паритета фич (scripts/check-feature-parity.mjs) ищет буквальный
      // первый аргумент authedFetch(...), а не резолвит идентификаторы.
      const res = await authedFetch('/api/account/export');
      if (!res.ok) {
        setStatus('error');
        return;
      }
      const blob = await res.blob();
      const filename =
        filenameFromDisposition(res.headers.get('Content-Disposition')) ??
        FALLBACK_FILENAME;
      const url = URL.createObjectURL(blob);
      let triggered = true;
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        triggered = false;
      } finally {
        URL.revokeObjectURL(url);
      }
      // `done`, а не возврат в `idle`: клик мог отработать без исключения, а
      // вебвью — молча проглотить скачивание, и тогда кнопка просто вернулась
      // бы в исходный вид, как будто ничего и не просили. Обработанная авария
      // невидимее необработанной (правило №14), поэтому экран говорит, чего
      // ждать, и что делать, если файла нет.
      setStatus(triggered ? 'done' : 'unsupported');
    } catch {
      setStatus('error');
    }
  }, [authedFetch]);

  return { status, exportData };
}
