// Офлайн-очередь оценок потребностей — единственная копия (правило №3).
// Ключ `rating_outbox_v1` не меняется: очередь, начатая в старом мини-аппе
// (тот же origin), обязана дойти с сайта.
//
// Буферизуются ТОЛЬКО оценки: сервер пишет их upsert'ом по (userId, date,
// needId), и повтор той же {needId, date} перезаписывает значение, а не
// заводит дубль. Заметки, дневники, письма и планы такой идемпотентности не
// имеют и не ретраятся вовсе: сеть в webview рвётся часто, «тихий» повтор
// задвоил бы данные — человек видит ошибку и повторяет сам.
import { readLocal, removeLocal, writeLocal } from './safeLocalStorage';

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
  const raw = readLocal(OUTBOX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed.filter(isOutboxItem);
  } catch {
    // Битый JSON (или неожиданная форма) — тихий сброс очереди, а не краш
    // приложения на старте.
    removeLocal(OUTBOX_KEY);
    return [];
  }
}

/** false — хранилище недоступно (приватный режим, квота): записи нет. */
function writeOutbox(items: OutboxItem[]): boolean {
  if (items.length === 0) return removeLocal(OUTBOX_KEY);
  // Старые вытесняются, если очередь переполнена.
  const trimmed =
    items.length > MAX_ITEMS ? items.slice(items.length - MAX_ITEMS) : items;
  return writeLocal(OUTBOX_KEY, JSON.stringify(trimmed));
}

/** false — положить некуда: оценка не сохранена нигде (вызывающий откатывает её). */
export function enqueueRating(item: OutboxItem): boolean {
  return writeOutbox([...readOutbox(), item]);
}

/**
 * Оценки дня `date`, ещё лежащие в очереди: needId → последнее значение.
 * Экран дня кладёт их поверх ответа сервера (QA 2026-11-03, З9: после
 * перезагрузки плитка показывала «1 из 5» — чтение обогнало выгрузку
 * очереди, а в БД уже было 5 из 5). Снимок берётся ДО запроса оценок:
 * очередь чистится только после того, как сервер принял всё отправленное,
 * поэтому оценка либо есть в снимке, либо уже лежала на сервере к моменту
 * чтения — щели между ними нет.
 */
export function pendingRatingsFor(date: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of readOutbox())
    if (it.date === date) out[it.needId] = it.value;
  return out;
}

const keyOf = (it: OutboxItem) => `${it.needId}|${it.date}`;

// Дедуп по (needId, date): побеждает последняя запись по этому ключу,
// порядок отправки — по первому вхождению ключа в очереди.
function dedupe(items: OutboxItem[]): OutboxItem[] {
  const order: string[] = [];
  const byKey = new Map<string, OutboxItem>();
  for (const it of items) {
    if (!byKey.has(keyOf(it))) order.push(keyOf(it));
    byKey.set(keyOf(it), it);
  }
  return order.map((key) => byKey.get(key)!);
}

// Из очереди, ПЕРЕЧИТАННОЙ после отправки, снимаются ровно записи снимка
// (по одной на каждую), а не «хвост по счёту»: оценка, поставленная во время
// выгрузки, дописана в конец и остаётся ждать (аудит 2026-11, E3).
function withoutSent(current: OutboxItem[], sent: OutboxItem[]): OutboxItem[] {
  const rest = [...current];
  for (const it of sent) {
    const i = rest.findIndex(
      (r) => keyOf(r) === keyOf(it) && r.value === it.value,
    );
    if (i !== -1) rest.splice(i, 1);
  }
  return rest;
}

async function drain(
  post: (item: OutboxItem) => Promise<void>,
  onRecovered?: (count: number) => void,
): Promise<void> {
  const snapshot = readOutbox();
  const sentKeys = new Set<string>();
  for (const item of dedupe(snapshot)) {
    try {
      await post(item);
      sentKeys.add(keyOf(item));
    } catch {
      break;
    }
  }
  if (sentKeys.size === 0) return;
  const sent = snapshot.filter((it) => sentKeys.has(keyOf(it)));
  writeOutbox(withoutSent(readOutbox(), sent));
  onRecovered?.(sentKeys.size);
}

// Одна выгрузка за раз: старт приложения и событие `online` приходят почти
// вместе, и две параллельные выгрузки слали одни и те же оценки дважды.
let flushing: Promise<void> | null = null;

/**
 * Отправляет очередь по порядку. Останавливается на первой ошибке (сеть, 5xx,
 * 401 до перевыпуска сессии, 429) и оставляет неотправленное в очереди.
 * Повторный вызов во время выгрузки получает ту же выгрузку.
 */
export function flushRatingOutbox(
  post: (item: OutboxItem) => Promise<void>,
  // Вызывается один раз, если что-то реально доехало (аналитика outbox_flush).
  onRecovered?: (count: number) => void,
): Promise<void> {
  flushing ??= drain(post, onRecovered).finally(() => {
    flushing = null;
  });
  return flushing;
}
