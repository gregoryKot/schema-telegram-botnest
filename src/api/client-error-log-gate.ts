import { AlertBudget, AlertThrottle } from '../utils/alert-throttle';

// Решение «что записать про отчёт фронтенда» (находка аудита 2026-10-11).
//
// Раньше полный detail (до ~5 КБ: message + url + stack) уходил в stdout на
// КАЖДЫЙ запрос. POST /api/client-errors открыт без входа, и аноним мог
// заполнить ротацию логов (на VPS 5 × 10 МБ) за час: строки настоящей аварии
// вытеснялись, а в DM уходила одна. Два слоя:
//   1. по устройству: ключ `source|section|ip`, окно 5 мин. Повтор того же
//      крэша с того же IP новых подробностей не несёт — подробно пишется один
//      раз, остальные копятся числом и приезжают в первом отчёте следующего
//      окна (meta.suppressed → блок «Поломки на клиенте» в /stats). Лог и
//      счётчик решаются ОДНИМ вердиктом: раздельные троттлы не имели смысла.
//      В ключе нет message — иначе аноним обходил бы троттл сменой текста.
//   2. общий бюджет на подробные строки. Слой 1 пускает каждый новый ключ, а
//      ключей на один IP до 22 (11 секций × 2 площадки) — перебор IP проходит
//      его целиком (src/utils/alert-throttle.ts).
//      Бюджет ограничивает stdout числом K × 5 КБ в минуту при любом числе IP.
//      Сверх бюджета событие всё равно считается, с meta.unlogged.
// Принятый хвост: повторы в ПОСЛЕДНЕМ окне шквала, после которого ключ больше
// не появился, в /stats не попадут (число сообщается при следующем допуске).
// Инстансов может быть несколько — у каждого свой лимит; источник правды для
// отчёта — БД, а не память.
export type ClientErrorVerdict =
  { kind: 'repeat' } | { kind: 'full' | 'unlogged'; repeats: number };

const DEVICE_WINDOW_MS = 5 * 60_000;
const DETAIL_BUDGET_WINDOW_MS = 60_000;
const DETAIL_BUDGET_PER_WINDOW = 20;

export class ClientErrorLogGate {
  private readonly perDevice = new AlertThrottle(DEVICE_WINDOW_MS);
  private readonly detailBudget = new AlertBudget(
    DETAIL_BUDGET_WINDOW_MS,
    DETAIL_BUDGET_PER_WINDOW,
  );

  take(key: string, now: number = Date.now()): ClientErrorVerdict {
    const device = this.perDevice.take(key, now);
    if (!device.allow) return { kind: 'repeat' };
    const budget = this.detailBudget.take('detail', now);
    return {
      kind: budget.allow ? 'full' : 'unlogged',
      repeats: device.suppressed,
    };
  }
}
