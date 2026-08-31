// Инцидент 2026-08-31: Postgres стал недоступен, и один и тот же сбой
// разошёлся по AlertLogger как ДЕСЯТКИ РАЗНЫХ по тексту сообщений — объект
// Prisma-ошибки (`{"code":"P1001","meta":{"modelName":"Booking"}}`),
// `processQueue failed: … Can't reach database server`, `Prisma error on
// /api/…` из prisma-exception.filter.ts, `healthy-adult catch-up failed`.
// У каждого свой ключ троттлинга — пер-ключевой троттл и общий бюджет
// (15/60с) захлебнулись: одна авария дала замьюченный чат, то есть ноль
// алертов (тот же урок, что 2026-07-29). Вторая дыра: guard в
// telegram.schedule.service.ts искал подстроку `P1001` в ТЕКСТЕ ошибки, а
// Prisma кладёт код в поле `err.code` — guard молчал и DM всё равно уходил.
//
// Этот модуль классифицирует «БД недоступна» НА УРОВНЕ ДОСТАВКИ — один раз,
// не по каждому вызывающему — и держит состояние аварии, чтобы весь шторм
// схлопнулся в один DM плюс одно сообщение о восстановлении.

// Тема письма-фолбэка (Telegram недоступен → e-mail). Одна на оба сообщения
// об аварии — и на первое, и на «база снова отвечает».
export const DB_ALERT_SUBJECT = 'База данных SchemeHappens';

// Сильные признаки — сами по себе достаточны, независимо от контекста.
const STRONG_SIGNALS = [
  'p1001',
  'p1017',
  'p2024',
  'databasenotreachable',
  "can't reach database server",
  'can’t reach database server', // типографский апостроф
  'server has closed the connection',
  'timed out fetching a new connection from the pool',
];

// Слабые признаки — общая формулировка сетевого сбоя, которая с тем же
// успехом описывает отказ api.telegram.org. Засчитываются только рядом с
// явным упоминанием БД, иначе авария Telegram схлопнулась бы в «БД легла».
const WEAK_SIGNALS = [
  'econnrefused',
  'connect etimedout',
  'connection terminated',
];
const DB_CONTEXT = ['prisma', 'database', 'postgres', ':5432'];

function safeStringify(value: object): string {
  try {
    return JSON.stringify(value);
  } catch {
    return ''; // циклическая ссылка — не бросаем, просто теряем этот кусок текста
  }
}

/** Собирает искомый текст из строки / Error / произвольного объекта-ошибки. */
function extractText(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof Error) {
    const code = (input as Error & { code?: unknown }).code;
    return `${typeof code === 'string' ? code : ''} ${input.message} ${safeStringify(input)}`;
  }
  if (input && typeof input === 'object') {
    const code = (input as { code?: unknown }).code;
    const message = (input as { message?: unknown }).message;
    return `${typeof code === 'string' ? code : ''} ${typeof message === 'string' ? message : ''} ${safeStringify(input)}`;
  }
  return String(input);
}

function normalize(input: unknown): string {
  return extractText(input).toLowerCase().replace(/’/g, "'");
}

/**
 * «Это авария БД» — строгая проверка. Слабый признак засчитывается только с
 * контекстом БД, иначе отказ api.telegram.org уехал бы админу под заголовком
 * «База данных не отвечает» и увёл бы разбор не туда.
 */
export function isDbUnreachable(input: unknown): boolean {
  const lower = normalize(input);
  if (STRONG_SIGNALS.some((s) => lower.includes(s))) return true;
  if (WEAK_SIGNALS.some((s) => lower.includes(s))) {
    return DB_CONTEXT.some((c) => lower.includes(c));
  }
  return false;
}

/**
 * «Это обрыв соединения» — мягкая проверка, без требования контекста БД.
 * Нужна там, где важно не КУДА оборвалось соединение, а что ошибка временная
 * и следующий тик крона её переживёт (telegram.schedule.service.ts): такую
 * ошибку логируем как warn, чтобы она не будила админа каждую минуту.
 */
export function isConnectionError(input: unknown): boolean {
  const lower = normalize(input);
  return [...STRONG_SIGNALS, ...WEAK_SIGNALS].some((s) => lower.includes(s));
}

function firstLine(message: string): string {
  return message.split('\n')[0] ?? message;
}

function formatError(message: string, max = 300): string {
  const line = firstLine(message);
  return line.length > max ? line.slice(0, max) : line;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  return minutes < 1 ? 'меньше минуты' : `${minutes} мин`;
}

/** Состояние одной аварии БД. Время приходит параметром — без таймеров. */
export class DbOutageTracker {
  private openedAt: number | null = null;
  private lastNotifiedAt = 0;
  private errorCount = 0;

  constructor(private readonly reminderMs = 15 * 60_000) {}

  get isOpen(): boolean {
    return this.openedAt !== null;
  }

  note(message: string, now: number = Date.now()): { text: string | null } {
    this.errorCount += 1;

    if (this.openedAt === null) {
      this.openedAt = now;
      this.lastNotifiedAt = now;
      return {
        text:
          `🚨 База данных не отвечает\n${formatError(message)}\n` +
          'Остальные ошибки этой аварии не шлю — сообщу, когда база вернётся.',
      };
    }

    if (now - this.lastNotifiedAt >= this.reminderMs) {
      this.lastNotifiedAt = now;
      return {
        text:
          `🚨 База данных не отвечает уже ${formatDuration(now - this.openedAt)}\n` +
          `Ошибок за это время: ${this.errorCount}\n${formatError(message)}`,
      };
    }

    return { text: null };
  }

  resolve(now: number = Date.now()): string | null {
    if (this.openedAt === null) return null;
    const duration = formatDuration(now - this.openedAt);
    const count = this.errorCount;
    this.reset();
    return `✅ База данных снова отвечает\nАвария длилась ${duration}, ошибок за это время: ${count}`;
  }

  reset(): void {
    this.openedAt = null;
    this.lastNotifiedAt = 0;
    this.errorCount = 0;
  }
}

// Общий на процесс синглтон: AlertLogger создаётся до DI-контейнера, а
// DbOutageMonitorService (src/infra/db-outage.service.ts) — уже внутри
// Nest, и обоим нужно одно и то же состояние аварии.
export const dbOutage = new DbOutageTracker();
