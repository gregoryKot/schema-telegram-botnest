/**
 * Чистые сборщики отчёта о публикации: что видит владелец в /zv, в админке и в
 * алерте. Вынесены из сервиса, потому что формулировки — единственное, что
 * владелец о канале и читает, а тестировать их проще без DI и без Prisma.
 */
import type {
  ChannelTarget,
  Delivery,
  DeliveryFailure,
  PublishResult,
  SilentTarget,
} from './channel-target';
import { isUnknownReason } from './unknown-outcome';

/** «Telegram (@channel)» — площадка и точка, куда именно ушло. */
const named = (d: Delivery): string => `${d.title} (${d.destination})`;

const namedList = (items: Delivery[]): string => items.map(named).join(', ');

/** Строки «Telegram (@ch) — 400: chat not found», по одной на площадку. */
export function failedSummary(failed: DeliveryFailure[]): string {
  return failed.map((f) => `${named(f)} — ${f.reason}`).join('\n');
}

/**
 * «Молчали: Threads — нет HEALTHY_ADULT_THREADS_USER». Без строки выключенная
 * площадка неотличима от успешной (утро 2026-07-31 выглядело «всё хорошо»).
 * DM только о молчащих — раз в неделю, а не каждый слот: `slot-report.ts`.
 */
export function silentSummary(silent: SilentTarget[]): string {
  if (silent.length === 0) return '';
  const list = silent.map((s) => `${s.title} — нет ${s.envKey}`).join('\n');
  return `\nМолчали:\n${list}`;
}

/** Ничего не отправлено: публиковать нечего или некуда. */
const notPosted = (
  message: string,
  silent: SilentTarget[] = [],
): PublishResult => ({
  ok: false,
  posted: false,
  message,
  delivered: [],
  failed: [],
  silent,
});

/**
 * Ни одной включённой площадки. Отдельный случай, а не ошибка отправки: чинить
 * тут нечего, надо задать env — поэтому в тексте сразу видно, какой именно.
 */
export function allDisabled(
  targets: Pick<ChannelTarget, 'title' | 'envKey'>[],
): PublishResult {
  const hints = targets.map((t) => `${t.title} — задай ${t.envKey}`).join('\n');
  const tail = hints ? `\n${hints}` : '';
  return notPosted(
    `⚠️ Постинг выключен: ни одна площадка не настроена.${tail}`,
    targets.map((t) => ({ title: t.title, envKey: t.envKey })),
  );
}

/** Пул кончился — публиковать нечего, площадки ни при чём. */
export const emptyPool = (): PublishResult =>
  notPosted('⚠️ Нет активных фраз — добавь их в админке (вкладка «Канал ЗВ»).');

/**
 * Флаг «публикация в полёте» занят (one-at-a-time.ts): эта публикация не
 * запущена — иначе в канале вышло бы два поста. `holder` — кто держит флаг.
 */
export const publishBusy = (holder: string | null): PublishResult =>
  notPosted(
    `⏳ Сейчас выходит ${holder ?? 'другая публикация'} — эта не запущена, ` +
      'иначе в канале будет два поста. Повторить можно через пару минут.',
  );

/**
 * Итог рассылки одного текста по площадкам. Три исхода различимы с первого
 * символа: ✅ дошло везде, ⚠️ дошло не везде, ❌ не дошло никуда.
 *
 * `posted` — пост мог выйти: дошло хотя бы куда-то или у площадки исход
 * неизвестен (unknown-outcome.ts). Хвост R7: с `posted: false` слот оставался
 * открытым, и следующий тик публиковал там, где пост, возможно, уже вышел.
 */
export function fanoutResult(
  text: string,
  delivered: Delivery[],
  failed: DeliveryFailure[],
  silent: SilentTarget[] = [],
): PublishResult {
  const posted =
    delivered.length > 0 || failed.some((f) => isUnknownReason(f.reason));
  const ok = posted && failed.length === 0;
  return {
    ok,
    posted,
    message: report(text, delivered, failed, silent),
    delivered,
    failed,
    silent,
  };
}

function report(
  text: string,
  delivered: Delivery[],
  failed: DeliveryFailure[],
  silent: SilentTarget[],
): string {
  const quiet = silentSummary(silent);
  if (delivered.length === 0)
    return `❌ Не дошло:\n${failedSummary(failed)}${quiet}`;
  const head =
    failed.length === 0
      ? `✅ Опубликовано: ${namedList(delivered)}`
      : `⚠️ Опубликовано: ${namedList(delivered)}\nНе дошло:\n${failedSummary(failed)}`;
  return `${head}${quiet}\n\n${text}`;
}

/**
 * Проверка одной площадки (`/zv max`). Отдельная формулировка, чтобы владелец
 * не принял её за настоящую публикацию: текст не новый и в историю не попал.
 */
export function checkResult(
  target: Pick<ChannelTarget, 'platform' | 'title'>,
  destination: string,
  text: string,
  reason?: string,
): PublishResult {
  const where = {
    platform: target.platform,
    title: target.title,
    destination,
  };
  if (reason)
    return {
      ok: false,
      posted: false,
      message: `❌ Проверка ${target.title} (${destination}) — не дошло:\n${reason}`,
      delivered: [],
      failed: [{ ...where, reason }],
      silent: [],
    };
  return {
    ok: true,
    posted: false,
    message: `✅ Проверка ${target.title} (${destination}): дошло.\nПул не тронут, в историю не записано.\n\n${text}`,
    delivered: [where],
    failed: [],
    silent: [],
  };
}

/**
 * Имя площадки не узнали или она не настроена: подсказываем, что писать —
 * иначе владелец гадает между `/zv max`, `/zv MAX` и `/zv макс`.
 */
export function unknownPlatform(
  asked: string,
  known: string[],
  disabled?: { title: string; envKey: string },
): PublishResult {
  const message = disabled
    ? `⚠️ ${disabled.title} не настроен — задай ${disabled.envKey}.`
    : `⚠️ Площадка «${asked}» неизвестна. Доступные: ${known.join(', ')}.`;
  return notPosted(message, disabled ? [disabled] : []);
}
