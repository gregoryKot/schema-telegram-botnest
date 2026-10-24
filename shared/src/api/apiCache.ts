// In-memory кеш GET-ответов API — единственная реализация для обоих
// фронтендов (правило №3 CLAUDE.md). Родилось из замера 2026-08-22: возврат
// на уже открытую вкладку мини-аппа стоил ~660мс повторных сетевых запросов —
// экран показывал скелетон ради данных, которые секунду назад уже приезжали.
//
// Три механизма:
// 1. Дедупликация одновременных GET — общий in-flight промис по ключу.
// 2. Stale-while-revalidate: `fresh` — отдаём из кеша, сеть не трогаем;
//    `stale` — отдаём из кеша СРАЗУ и обновляем в фоне; дальше — обычный
//    запрос. Подписчики (`subscribe`) узнают о новых данных из фонового
//    обновления — Promise из cachedGet() их не донесёт, он уже резолвнут.
// 3. Инвалидация по явной карте мутаций — см. apiCacheRules.ts.
//
// НИКАКОГО localStorage: кеш живёт только в памяти вкладки. Расшифрованные
// личные данные (дневники, письма, заметки) в постоянном хранилище — под
// запретом отдельным пунктом CLAUDE.md.
export const API_CACHE_FRESH_MS = 15_000;
export const API_CACHE_STALE_MS = 2 * 60_000;

interface CacheRecord<T> {
  data: T;
  storedAt: number;
}

export type InvalidationTarget = string | { prefix: string };

const store = new Map<string, CacheRecord<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const revalidating = new Set<string>();
const listeners = new Map<string, Set<(data: unknown) => void>>();

// Поколения — защита от гонки «запрос стартовал до, ответ пришёл после».
// Без них запись в кеш делает ЛЮБОЙ долетевший ответ, даже если пока он летел
// пользователь сохранил новое значение (мутация → invalidate) или вовсе вышел
// из аккаунта (clearApiCache). Тогда в кеш ложатся до-мутационные данные (и
// живут ещё 15 секунд как «свежие»), а после логаута — данные ПРЕДЫДУЩЕГО
// пользователя. Первое — ровно тот класс бага, против которого правило
// read-after-write в CLAUDE.md; второе — утечка между аккаунтами.
// Поэтому ответ пишется в кеш, только если ни ключ, ни кеш целиком не были
// сброшены с момента старта запроса. Самому вызывающему коду ответ отдаём
// в любом случае: он его запросил, отменить его запрос мы не вправе.
let cacheEpoch = 0;
const keyEpochs = new Map<string, number>();

const keyEpoch = (key: string): number => keyEpochs.get(key) ?? 0;

function bumpKeyEpoch(key: string): void {
  keyEpochs.set(key, keyEpoch(key) + 1);
}

function notify(key: string, data: unknown): void {
  listeners.get(key)?.forEach((fn) => fn(data));
}

/** Результат запроса ещё актуален — ключ не инвалидирован и юзер не сменился. */
function stillCurrent(key: string, startedAt: Epochs): boolean {
  return startedAt.cache === cacheEpoch && startedAt.key === keyEpoch(key);
}

interface Epochs {
  cache: number;
  key: number;
}

const epochsNow = (key: string): Epochs => ({
  cache: cacheEpoch,
  key: keyEpoch(key),
});

function commit(key: string, data: unknown, startedAt: Epochs): void {
  if (!stillCurrent(key, startedAt)) return;
  store.set(key, { data, storedAt: Date.now() });
  notify(key, data);
}

function runFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const startedAt = epochsNow(key);
  const p = fetcher()
    .then((data) => {
      commit(key, data, startedAt);
      return data;
    })
    .finally(() => {
      // Удаляем только СВОЙ промис: если ключ инвалидировали и следом
      // стартовал новый запрос, старый .finally не имеет права снять с
      // регистрации чужой in-flight (иначе дедупликация ломается).
      if (inFlight.get(key) === p) inFlight.delete(key);
    });
  inFlight.set(key, p);
  return p;
}

// Фоновое обновление протухшей (но ещё stale) записи. Не делится промисом с
// вызывающей стороной — та уже получила старые данные немедленно. Ошибка
// (сеть легла) молча гасится: уже показанные данные не стираем (см. тест).
function applyRevalidateResult<T>(
  key: string,
  promise: Promise<T>,
  startedAt: Epochs,
): Promise<void> {
  return promise.then((data) => {
    commit(key, data, startedAt);
  });
}

// best-effort: отказ фонового обновления НЕ должен стереть уже показанные
// данные — .catch(() => undefined) здесь контракт, не забытая обработка
// (см. apiCache.test.ts «ошибка фонового обновления»; аллоу-лист —
// scripts/silent-catch-rules.mjs CHAIN_ALLOW: applyRevalidateResult).
function revalidateInBackground<T>(
  key: string,
  fetcher: () => Promise<T>,
): void {
  if (revalidating.has(key)) return;
  revalidating.add(key);
  applyRevalidateResult(key, fetcher(), epochsNow(key))
    .catch(() => undefined)
    .finally(() => revalidating.delete(key));
}

/**
 * GET с кешем. `key` — полный путь с query-строкой (разные `?days=7` и
 * `?days=112` — разные записи). `fetcher` — реальный сетевой вызов.
 */
export function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const record = store.get(key) as CacheRecord<T> | undefined;
  const age = record ? Date.now() - record.storedAt : Infinity;

  if (record && age <= API_CACHE_FRESH_MS) {
    return Promise.resolve(record.data);
  }
  if (record && age <= API_CACHE_STALE_MS) {
    revalidateInBackground(key, fetcher);
    return Promise.resolve(record.data);
  }

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  return runFetch(key, fetcher);
}

/** Уведомления о свежих данных из фонового revalidate (см. пункт 2 выше). */
export function subscribe<T>(
  key: string,
  listener: (data: T) => void,
): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  const fn = listener as (data: unknown) => void;
  set.add(fn);
  return () => {
    set?.delete(fn);
    if (set && set.size === 0) listeners.delete(key);
  };
}

/** Сбрасывает конкретные ключи (строка) или все ключи с префиксом. */
export function invalidate(targets: InvalidationTarget[]): void {
  for (const target of targets) {
    if (typeof target === 'string') {
      dropKey(target);
      continue;
    }
    // Ключи берём из обоих реестров: запрос, который ещё летит, тоже обязан
    // потерять право записаться в кеш — иначе до-мутационный ответ ляжет
    // поверх только что сохранённого.
    const affected = new Set([...store.keys(), ...inFlight.keys()]);
    for (const key of affected) {
      if (key.startsWith(target.prefix)) dropKey(key);
    }
  }
}

function dropKey(key: string): void {
  store.delete(key);
  inFlight.delete(key);
  bumpKeyEpoch(key);
}

/** Логаут / смена userId (device-link, merge) — кеш не переживает смену пользователя. */
export function clearApiCache(): void {
  cacheEpoch += 1;
  store.clear();
  inFlight.clear();
  revalidating.clear();
  keyEpochs.clear();
}

// /api/auth/* и health — обязаны быть свежими всегда, кешу тут не место.
// На практике эти пути и так не идут через cachedGet() (см. apiClient.ts
// обоих фронтендов), проверка здесь — подстраховка на будущее.
const NON_CACHEABLE_PATH_PATTERNS = [/^\/api\/auth\//, /^\/health(\/|$)/];

export function isCacheableGetPath(path: string): boolean {
  return !NON_CACHEABLE_PATH_PATTERNS.some((re) => re.test(path));
}
