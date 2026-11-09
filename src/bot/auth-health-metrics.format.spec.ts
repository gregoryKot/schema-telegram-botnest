// Форматтер блока «Вход в мессенджере» для /stats. Пустое состояние проверяем
// обязательно (правило №8): на чистой БД отчёт не должен пугать нулями и
// «NaN», а на живой аварии — обязан говорить прямо. С 2026-11 блок считает
// обмен подписи на сессию (прошёл / не прошёл с причиной) по площадкам, а
// пустую подпись старых окон мини-аппа — отдельной строкой.
import { formatAuthHealth } from './auth-health-metrics.format';
import type { AuthHealthMetrics, ExchangeCounts } from './auth-health-rows';

type Cell = [day: number, week: number];
const counts = (
  ok: Cell = [0, 0],
  expired: Cell = [0, 0],
  suspicious: Cell = [0, 0],
): ExchangeCounts => ({
  ok: { day: ok[0], week: ok[1] },
  expired: { day: expired[0], week: expired[1] },
  suspicious: { day: suspicious[0], week: suspicious[1] },
});
const metrics = (
  telegram = counts(),
  max = counts(),
  legacyEmptyWeek = 0,
): AuthHealthMetrics => ({ hosts: { telegram, max }, legacyEmptyWeek });

describe('formatAuthHealth', () => {
  it('совсем чистая БД — «сравнивать пока не с чем», без нулей и NaN', () => {
    const text = formatAuthHealth(metrics());
    expect(text).toContain('Вход в мессенджере');
    expect(text).toContain('сравнивать пока не с чем');
    expect(text).not.toMatch(/NaN|undefined|null|:\s*0|\b0\b/);
    expect(text).not.toContain('старые окна');
  });

  it('входы без сбоев — считает числом, с верным склонением', () => {
    expect(formatAuthHealth(metrics(counts([40, 262]), counts([1, 2])))).toBe(
      '🔑 <b>Вход в мессенджере</b>\n' +
        'За неделю вошли из мессенджера 264 раза, сбоев не было.',
    );
    expect(formatAuthHealth(metrics(counts([1, 1])))).toContain(
      'вошли из мессенджера 1 раз,',
    );
  });

  it('сбой идёт прямо сейчас — площадка, причины, доля успешных и призыв проверить', () => {
    const text = formatAuthHealth(
      metrics(counts([20, 120], [4, 12], [0, 3]), counts([5, 30])),
    );
    expect(text).toContain('Не все смогли войти из мессенджера:');
    expect(text).toContain(
      'Telegram за неделю: вошли 120, не смогли 15 (устарела 12, не сошлась 3); ' +
        'за сутки: вошли 20, не смогли 4 (устарела 4)',
    );
    // MAX без отказов, но со входами — строка есть, без скобок причин.
    expect(text).toContain(
      'MAX за неделю: вошли 30, не смогли 0; за сутки: вошли 5, не смогли 0',
    );
    // 150 удачных из 165 попыток → 91%.
    expect(text).toContain('Успешных входов за неделю: 150 из 165 (91%).');
    expect(text).toContain('окно мессенджера висело открытым дольше часа');
    expect(text).toContain('подделка или сменился ключ бота');
    expect(text).toContain(
      'Это происходит прямо сейчас — открой приложение в мессенджере и проверь вход.',
    );
    expect(text).not.toContain('похоже, уже починено');
  });

  it('за неделю сбои были, за сутки нет — «похоже, уже починено»', () => {
    const text = formatAuthHealth(metrics(counts([10, 50], [0, 0], [0, 7])));
    expect(text).toContain('За сутки сбоев не было — похоже, уже починено.');
    expect(text).not.toContain('прямо сейчас');
    // Устаревших не было — пояснение про час не нужно.
    expect(text).not.toContain('дольше часа');
    expect(text).toContain('подделка или сменился ключ бота');
  });

  it('площадка без событий за неделю в строки не попадает', () => {
    const text = formatAuthHealth(metrics(counts(), counts([0, 2], [1, 1])));
    expect(text).toContain('MAX за неделю: вошли 2, не смогли 1 (устарела 1)');
    expect(text).not.toContain('Telegram');
    expect(text).toContain('Успешных входов за неделю: 2 из 3 (67%).');
  });

  it('старые окна мини-аппа — строка с пояснением, только если они были', () => {
    const withLegacy = formatAuthHealth(metrics(counts([3, 9]), counts(), 5));
    expect(withLegacy).toContain(
      'Без пропуска входа пришли старые окна: 5 раз за неделю.',
    );
    expect(withLegacy).toContain('до того, как убрали мини-приложение');
    // Обменов не было, а старые окна есть — обе строки, без NaN.
    const onlyLegacy = formatAuthHealth(metrics(counts(), counts(), 2));
    expect(onlyLegacy).toContain('сравнивать пока не с чем');
    expect(onlyLegacy).toContain('старые окна: 2 раза за неделю');
    expect(onlyLegacy).not.toMatch(/NaN|undefined/);
  });

  it('язык простой: ни имён событий, ни английских слов, кроме названий мессенджеров', () => {
    const texts = [
      formatAuthHealth(metrics()),
      formatAuthHealth(metrics(counts([1, 10]))),
      formatAuthHealth(metrics(counts([1, 10], [1, 2], [1, 3]), counts(), 4)),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/messenger_launch|auth_|expired|suspicious/);
      const words = text.replace(/<\/?b>/g, '').replace(/Telegram|MAX/g, '');
      expect(words).not.toMatch(/[A-Za-z]/);
    }
  });
});
