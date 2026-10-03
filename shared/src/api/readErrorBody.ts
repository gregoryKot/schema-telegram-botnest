// Разбор тела НЕуспешного ответа API — единая реализация для обоих фронтендов
// (правило №3). Сервер кладёт в тело `message` (человеческий текст) и иногда
// `reason` — машинный код причины (например, `already_connected` у
// POST /api/therapy/join). Тело может прийти не-JSON (502 от прокси, обрыв):
// тогда message — «API error: <status>», reason нет.
export interface ErrorBodyInfo {
  message: string;
  reason?: string;
}

interface ErrorBodyShape {
  message?: unknown;
  reason?: unknown;
}

// Не-JSON тело — штатный исход (502 от прокси, пустой ответ), а не ошибка,
// которую надо показывать: вместо текста сервера берём «API error: <status>».
async function parseBody(res: Response): Promise<ErrorBodyShape | null> {
  try {
    const parsed: unknown = await res.json();
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function readErrorBody(res: Response): Promise<ErrorBodyInfo> {
  const body = await parseBody(res);
  const raw = body?.message;
  const message = raw
    ? typeof raw === 'string'
      ? raw
      : JSON.stringify(raw)
    : `API error: ${res.status}`;
  return typeof body?.reason === 'string'
    ? { message, reason: body.reason }
    : { message };
}
