// Что из logger.error() уходит владельцу в DM и в письмо (РКН, #1135): место,
// тип ошибки и id — без текста. В тексте ошибки бывают email, имя, ответ
// площадки и аргументы запроса Prisma. Полный текст пишется в stdout с тем же
// id: по id из Telegram строка находится в логах.
import { createHash } from 'crypto';
import { inspect } from 'util';
import { isMoneyAlert } from './money-alert';

export const SERVER_ALERT_TITLE = '🚨 Ошибка на сервере';

/** Имя класса из ≥2 частей (`BookingService`, `OAuthCallbackService`); одно слово — «—». */
const PLACE = /^(?=.{2,80}$)(?=.*[a-z])[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*$/;
/** Имя класса ошибки: `TypeError`, `PrismaClientKnownRequestError`, `HttpException`. */
const ERROR_CLASS = /^(?:[A-Z][\w$]*(?:Error|Exception)|Error)$/;
/** Код ошибки: `P2002`, `ECONNREFUSED`, `ERR_INVALID_URL`. */
const ERROR_CODE = /^[A-Z][A-Z0-9_]{0,39}$/;

export interface AlertFacts {
  /** Текст для ключа троттлинга и классификатора аварии БД; в DM не уходит. */
  text: string;
  /** Контекст для бюджетов AlertGate: последний строковый аргумент. */
  context: string | undefined;
  place: string;
  type: string;
  id: string;
  /** Строка для stdout: полный текст с id в начале. */
  logLine: string;
}

function stringify(message: unknown): string {
  if (typeof message === 'string') return message;
  try {
    return JSON.stringify(message) ?? String(message);
  } catch {
    return inspect(message); // циклическая ссылка: error() не бросает
  }
}

function codeOf(err: Error): string | null {
  const code = (err as Error & { code?: unknown }).code;
  if (typeof code === 'number' && Number.isInteger(code)) return String(code);
  return typeof code === 'string' && ERROR_CODE.test(code) ? code : null;
}

/** Имя класса и код — только если похожи на идентификаторы, а не на текст. */
function typeOfError(err: Error): string | null {
  const parts = [ERROR_CLASS.test(err.name) ? err.name : null, codeOf(err)];
  const known = parts.filter((p): p is string => p !== null);
  return known.length > 0 ? known.join(' ') : null;
}

/** Первая строка stack-строки: идентификатор до `:` («TypeError: …»). */
function typeOfStack(stack: string): string | null {
  const head = /^([A-Za-z_$][\w$]*)(?::|$)/.exec(stack.split('\n', 1)[0]);
  return head && ERROR_CLASS.test(head[1]) ? head[1] : null;
}

/** Тип ошибки среди аргументов: объект ошибки, затем stack-строка, иначе «—». */
export function errorType(values: readonly unknown[]): string {
  for (const v of values) {
    const t = v instanceof Error ? typeOfError(v) : null;
    if (t) return t;
  }
  for (const v of values) {
    const t = typeof v === 'string' ? typeOfStack(v) : null;
    if (t) return t;
  }
  return '—';
}

/** Короткий id строки: 8 hex от места и текста. */
export function alertId(place: string, text: string): string {
  const hash = createHash('sha256').update(`${place}\n${text}`);
  return hash.digest('hex').slice(0, 8);
}

/** Разбор аргументов error() так же, как их видит Nest: контекст — последний. */
export function alertFacts(
  message: unknown,
  params: readonly unknown[],
  ownContext?: string,
): AlertFacts {
  const last = params[params.length - 1];
  const context = typeof last === 'string' ? last : ownContext;
  const place =
    [context, ownContext].find((c) => c !== undefined && PLACE.test(c)) ?? '—';
  const text = stringify(message);
  const id = alertId(place, text);
  const body = typeof message === 'string' ? message : inspect(message);
  const type = errorType([message, ...params]);
  return { text, context, place, type, id, logLine: `[alert ${id}] ${body}` };
}

/**
 * Текст DM. Денежный текст (moneyAlert) собирают из InvId, суммы и статуса —
 * он уходит целиком, без него платёж не найти; остальное — без текста.
 */
export function serverAlertText(facts: AlertFacts): string {
  const money = isMoneyAlert(facts.text) ? `\n${facts.text.slice(0, 300)}` : '';
  return (
    `${SERVER_ALERT_TITLE}${money}\n` +
    `Место: ${facts.place}\nТип: ${facts.type}\nid: ${facts.id}`
  );
}
