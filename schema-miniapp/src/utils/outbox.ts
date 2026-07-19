// Оффлайн-очередь для оценок потребностей (этап 3, финальный пункт —
// консервативные ретраи/оффлайн-очередь API мини-аппа).
//
// Почему буферизуются ТОЛЬКО оценки, а не любые POST: сервер сохраняет
// рейтинг через upsert по (userId, date, needId) — повторная отправка той
// же {needId, date} безопасно перезаписывает значение, а не создаёт
// дубликат. Это единственный write-запрос в приложении с таким свойством.
// Заметки/дневники/письма/планы такой идемпотентности не имеют (могут
// завести вторую запись или дать неожиданный побочный эффект при повторе),
// поэтому они вообще не ретраятся — пользователь видит ошибку сразу и
// повторяет действие сам. По той же причине POST/DELETE в api.ts не
// ретраятся автоматически: сеть в Telegram-webview рвётся часто и без
// идемпотентности «тихий» повтор рискует задвоить данные.
export interface OutboxItem {
  needId: string;
  value: number;
  date: string;
}

const OUTBOX_KEY = 'rating_outbox_v1';
const MAX_ITEMS = 200;

function isOutboxItem(v: unknown): v is OutboxItem {
  if (!v || typeof v !== 'object') return false;
  const it = v as Record<string, unknown>;
  return (
    typeof it.needId === 'string' &&
    typeof it.value === 'number' &&
    typeof it.date === 'string'
  );
}

function readOutbox(): OutboxItem[] {
  const raw = localStorage.getItem(OUTBOX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed.filter(isOutboxItem);
  } catch {
    // Битый JSON (или неожиданная форма) — тихий сброс очереди, а не краш
    // приложения на старте.
    localStorage.removeItem(OUTBOX_KEY);
    return [];
  }
}

function writeOutbox(items: OutboxItem[]): void {
  if (items.length === 0) {
    localStorage.removeItem(OUTBOX_KEY);
    return;
  }
  // Старые вытесняются, если очередь переполнена.
  const trimmed =
    items.length > MAX_ITEMS ? items.slice(items.length - MAX_ITEMS) : items;
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(trimmed));
}

export function enqueueRating(item: OutboxItem): void {
  const items = readOutbox();
  items.push(item);
  writeOutbox(items);
}

// Дедуп по (needId, date): побеждает последняя запись по этому ключу,
// порядок отправки — по первому вхождению ключа в очереди.
function dedupe(items: OutboxItem[]): OutboxItem[] {
  const order: string[] = [];
  const byKey = new Map<string, OutboxItem>();
  for (const it of items) {
    const key = `${it.needId}|${it.date}`;
    if (!byKey.has(key)) order.push(key);
    byKey.set(key, it);
  }
  return order.map((key) => byKey.get(key)!);
}

/**
 * Отправляет очередь по порядку. Останавливается на первой ошибке (сетевой —
 * единственная ожидаемая на этом этапе, т.к. элементы уже прошли 4xx-проверку
 * при первой попытке saveRating) и оставляет неотправленный хвост в очереди.
 * Успешно отправленные элементы удаляются.
 */
export async function flushRatingOutbox(
  post: (item: OutboxItem) => Promise<void>,
  // Вызывается один раз, если что-то реально доехало (аналитика outbox_flush).
  onRecovered?: (count: number) => void,
): Promise<void> {
  const items = dedupe(readOutbox());
  if (items.length === 0) return;

  let sentCount = 0;
  for (const item of items) {
    try {
      await post(item);
      sentCount++;
    } catch {
      break;
    }
  }
  writeOutbox(items.slice(sentCount));
  if (sentCount > 0) onRecovered?.(sentCount);
}
