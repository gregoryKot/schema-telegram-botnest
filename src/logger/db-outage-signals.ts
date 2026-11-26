// Признаки «база недоступна» в тексте ошибки — для классификатора
// src/logger/db-outage.ts (isDbUnreachable / isConnectionError). Вынесены из
// него, чтобы список рос отдельно от машины состояний аварии (правило №10).
// Все строки — в нижнем регистре: классификатор сравнивает по lowercase.

/**
 * Отказ пула pg своими словами, без кода Postgres: `@prisma/adapter-pg`
 * перебрасывает такие ошибки как есть (`convertDriverError`), и без этих
 * строк авария базы не схлопывалась в одну «база не отвечает» (аудит 2026-10).
 * Обе фразы — только pg-pool (сверка с его исходником —
 * db-outage-signals.spec.ts), поэтому контекст БД в тексте им не нужен.
 * `P2024` — тот же смысл в старом движке Prisma.
 */
export const PG_POOL_SIGNALS = [
  'timeout exceeded when trying to connect',
  'connection terminated due to connection timeout',
];

/** Сильные признаки — сами по себе достаточны, независимо от контекста. */
export const STRONG_SIGNALS = [
  'p1001',
  'p1017',
  'p2024',
  'databasenotreachable',
  "can't reach database server",
  'can’t reach database server', // типографский апостроф
  'server has closed the connection',
  'timed out fetching a new connection from the pool',
  ...PG_POOL_SIGNALS,
];

/**
 * Слабые признаки — общая формулировка сетевого сбоя, которая с тем же
 * успехом описывает отказ api.telegram.org. Засчитываются только рядом с
 * явным упоминанием БД, иначе авария Telegram схлопнулась бы в «БД легла».
 */
export const WEAK_SIGNALS = [
  'econnrefused',
  'connect etimedout',
  'connection terminated',
];

/** Упоминание БД в тексте — контекст для слабого признака. */
export const DB_CONTEXT = ['prisma', 'database', 'postgres', ':5432'];
