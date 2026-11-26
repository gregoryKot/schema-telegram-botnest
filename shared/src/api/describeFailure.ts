// Причина сбоя для отчёта о поломке (`POST /api/client-errors`): тип и
// числовой статус, а не текст исключения. Раньше отчёты несли только имя
// источника («appshell bootstrap fail: YSQ», «login ticket start failed») —
// сеть, 429, 5xx и битое тело были неразличимы, и разбор 2026-10-03 (пустое
// тело на `null`, docs/INCIDENTS.md) потребовал чтения кода.
//
// Текст исключения в отчёт не идёт никогда: его пишет браузер или сервер, и
// он может нести адрес с секретом во фрагменте (`#access_token=…`, initData),
// код входа или кусок тела ответа (инвариант H0/H6
// `src/api/client-errors.controller.ts`). Отсюда выходит только значение из
// закрытого списка: `HTTP <код>`, `network`, `timeout`, `parse`, имя класса
// ошибки из латинских букв или `non-error`.
import { errorStatus, isNetworkError } from './humanizeError';

const CLASS_NAME = /^[A-Za-z]{1,40}$/;

export function describeFailure(err: unknown): string {
  const status = errorStatus(err);
  if (
    status !== undefined &&
    Number.isInteger(status) &&
    status >= 100 &&
    status <= 599
  )
    return `HTTP ${status}`;
  if (isNetworkError(err)) return 'network';
  // Таймаут запроса (shared/src/api/fetchWithTimeout.ts) обрывает fetch через
  // AbortController — браузер отклоняет промис DOMException с этим именем.
  const name = errorName(err);
  if (name === 'AbortError' || name === 'TimeoutError') return 'timeout';
  // Тело успешного ответа не разобралось (502-страница прокси, оборванный ответ).
  if (name === 'SyntaxError') return 'parse';
  return name && CLASS_NAME.test(name) ? name : 'non-error';
}

function errorName(err: unknown): string | undefined {
  if (err instanceof Error) return err.name;
  // DOMException в старых движках и jsdom не наследует Error.
  if (typeof err === 'object' && err !== null && 'name' in err) {
    return typeof err.name === 'string' ? err.name : undefined;
  }
  return undefined;
}
