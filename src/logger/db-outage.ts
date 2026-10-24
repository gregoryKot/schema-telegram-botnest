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

import { AlertBudget } from '../utils/alert-throttle';

// Тема письма-фолбэка (Telegram недоступен → e-mail). Одна на оба сообщения
// об аварии — и на первое, и на «база снова отвечает».
export const DB_ALERT_SUBJECT = 'База данных SchemeHappens';

// Ключ бюджета: у канала он один — все сообщения про доступность базы делят
// общий потолок.
const BUDGET_KEY = 'db';

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

/**
 * Состояние одной аварии БД. Время приходит параметром — без таймеров.
 *
 * Поверх машины состояний — бюджет на ВСЕ сообщения канала, включая «база
 * снова отвечает». Без него мигающая БД (легла — встала — легла) давала бы
 * пару DM в минуту: тот же флуд, что и до этой правки, только с другой
 * стороны. Потолок общий на первый алерт, напоминания и восстановление;
 * проглоченное считается и приезжает числом в следующем допущенном
 * сообщении, а не пропадает молча.
 */
export class DbOutageTracker {
  private openedAt: number | null = null;
  private lastNotifiedAt = 0;
  private errorCount = 0;

  private budget: AlertBudget;

  constructor(
    private readonly reminderMs = 15 * 60_000,
    private readonly budgetWindowMs = 60 * 60_000,
    private readonly budgetPerWindow = 6,
  ) {
    this.budget = new AlertBudget(budgetWindowMs, budgetPerWindow);
  }

  /** Пропускает текст через бюджет канала; null — сообщение проглочено. */
  private emit(text: string, now: number): string | null {
    const decision = this.budget.take(BUDGET_KEY, now);
    if (!decision.allow) return null;
    return decision.suppressed
      ? `${text}\n(подавлено ещё ${decision.suppressed} — потолок сообщений про базу)`
      : text;
  }

  get isOpen(): boolean {
    return this.openedAt !== null;
  }

  note(message: string, now: number = Date.now()): { text: string | null } {
    this.errorCount += 1;

    if (this.openedAt === null) {
      this.openedAt = now;
      this.lastNotifiedAt = now;
      return {
        text: this.emit(
          `🚨 База данных не отвечает\n${formatError(message)}\n` +
            'Остальные ошибки этой аварии не шлю — сообщу, когда база вернётся.',
          now,
        ),
      };
    }

    if (now - this.lastNotifiedAt >= this.reminderMs) {
      this.lastNotifiedAt = now;
      return {
        text: this.emit(
          `🚨 База данных не отвечает уже ${formatDuration(now - this.openedAt)}\n` +
            `Ошибок за это время: ${this.errorCount}\n${formatError(message)}`,
          now,
        ),
      };
    }

    return { text: null };
  }

  resolve(now: number = Date.now()): string | null {
    if (this.openedAt === null) return null;
    const duration = formatDuration(now - this.openedAt);
    const count = this.errorCount;
    // Авария закрывается в любом случае — даже когда бюджет проглотил само
    // сообщение. Иначе состояние осталось бы открытым навсегда, и сторожок
    // ходил бы в БД каждую минуту до перезапуска.
    this.clearOutage();
    return this.emit(
      `✅ База данных снова отвечает\nАвария длилась ${duration}, ошибок за это время: ${count}`,
      now,
    );
  }

  private clearOutage(): void {
    this.openedAt = null;
    this.lastNotifiedAt = 0;
    this.errorCount = 0;
  }

  /**
   * Полный сброс, включая бюджет, — чистый лист для тестов. Бюджет
   * переживает конец аварии НАМЕРЕННО (иначе мигающая БД обнуляла бы потолок
   * каждым восстановлением), поэтому обычный путь зовёт clearOutage().
   */
  reset(): void {
    this.clearOutage();
    this.budget = new AlertBudget(this.budgetWindowMs, this.budgetPerWindow);
  }
}

// Общий на процесс синглтон: AlertLogger создаётся до DI-контейнера, а
// DbOutageMonitorService (src/infra/db-outage.service.ts) — уже внутри
// Nest, и обоим нужно одно и то же состояние аварии.
export const dbOutage = new DbOutageTracker();
