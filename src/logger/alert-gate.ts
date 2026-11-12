import { AlertBudget } from '../utils/alert-throttle';
import { isMoneyAlert } from './money-alert';

// Решение «уходит ли error() владельцу в DM» — вынесено из alert.logger.ts.
//
// 1. Пер-контентный ключ (аудит 2026-07, I-4): одинаковый текст — не чаще раза
//    в 60 с; числа/uuid/hex в ключе схлопываются в плейсхолдер, иначе
//    «Failed … id=1», «id=2», … обходили троттлинг лавиной DM.
// 2. Общий бюджет за окно (M4, аудит 2026-08): ключ нормализует только цифры,
//    и текст, варьируемый буквами (имена параметров, текст ошибки разбора),
//    рождает новый ключ на каждый запрос. Поэтому сверху — не больше N алертов
//    за минуту СУММАРНО; сверх — счётчик в первом алерте следующего окна.
// 3. Анонимный подбюджет (аудит 2026-11, S13). Общий бюджет выжигался чужими
//    руками: ~5 IP раз в минуту доставали его до дна, и настоящая авария
//    уходила в «подавлено ещё N». Контексты, чей error() вызывает запрос БЕЗ
//    входа, живут в своём малом бюджете и основной не трогают: поломка входа
//    всё равно будит (первые ANON_BUDGET в минуту доходят), а мусор не глушит
//    остальное. Отчёты фронтенда сюда не попадают вовсе: они пишутся warn и
//    приезжают сводкой раз в час (src/api/client-errors-digest.ts).
// 4. Денежный бюджет (аудит 2026-11, хвост R9): текст из moneyAlert() идёт в
//    ключ целиком, с InvId, и в свой бюджет — см. ./money-alert.ts.
//
// Ключ помечается доставленным ТОЛЬКО после решения бюджета: раньше `seen`
// ставился до проверки, и ошибка, упёршаяся в потолок, молчала ещё 60 с и
// после того, как окно бюджета обновилось.

/**
 * Контексты (имя класса в `new Logger(X.name)`), чей error() может вызвать
 * аноним одним запросом. Совпадение с именами классов держит
 * alert-gate.spec.ts: переименованный класс без строки здесь роняет jest.
 */
export const ANON_ALERT_CONTEXTS: ReadonlySet<string> = new Set([
  'AuthOauthController', // колбэк VK: `vk callback error: …`
]);

export const KEY_WINDOW_MS = 60_000;
export const MAIN_BUDGET = 15;
export const ANON_BUDGET = 3;
export const MONEY_BUDGET = 10;

export type AlertVerdict = { send: false } | { send: true; tail: string };

/** Нормализованный ключ троттлинга: числа и uuid — плейсхолдером. */
export function alertKey(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<uuid>')
    .replace(/\d+/g, '<n>')
    .slice(0, 100);
}

export class AlertGate {
  private readonly seen = new Map<string, number>();
  private readonly main = new AlertBudget(60_000, MAIN_BUDGET);
  private readonly anon = new AlertBudget(60_000, ANON_BUDGET);
  private readonly money = new AlertBudget(60_000, MONEY_BUDGET);

  decide(message: string, context?: string, now = Date.now()): AlertVerdict {
    // Записи старше часа вычищаются — Map не растёт бесконечно.
    for (const [k, t] of this.seen)
      if (now - t > 3_600_000) this.seen.delete(k);

    const money = isMoneyAlert(message);
    const key = money ? message.slice(0, 300) : alertKey(message);
    if (now - (this.seen.get(key) ?? 0) < KEY_WINDOW_MS) return { send: false };

    const anon = context !== undefined && ANON_ALERT_CONTEXTS.has(context);
    const pool = money ? this.money : anon ? this.anon : this.main;
    const budget = pool.take('__all__', now);
    if (!budget.allow) return { send: false };
    this.seen.set(key, now);

    if (!budget.suppressed) return { send: true, tail: '' };
    const which = money
      ? 'потолок денежных алертов, остальные — в логе'
      : anon
        ? 'потолок ошибок входа, которые может вызвать любой запрос'
        : 'общий потолок алертов';
    return {
      send: true,
      tail: `\n(за прошлое окно подавлено ещё ${budget.suppressed} — ${which})`,
    };
  }
}
