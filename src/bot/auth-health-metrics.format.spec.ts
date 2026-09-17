// Форматтер блока «Вход в мессенджере» для /stats. Пустое состояние проверяем
// обязательно (правило №8): на чистой БД отчёт не должен пугать нулями и
// «NaN», а на живой аварии — обязан говорить прямо. С 2026-08-10 блок также
// считает успехи (auth_success) — регресс-тест на пустое состояние теперь
// различает «данных ещё нет» и «данные есть, и все хорошие».
import { formatAuthHealth } from './auth-health-metrics.format';

const metrics = (
  day: [number, number],
  week: [number, number],
  success: [number, number] = [0, 0],
): Parameters<typeof formatAuthHealth>[0] => ({
  day: { telegram: day[0], max: day[1] },
  week: { telegram: week[0], max: week[1] },
  successDay: success[0],
  successWeek: success[1],
});

describe('formatAuthHealth', () => {
  it('совсем чистая БД — «нет данных», а не «всё хорошо»', () => {
    const text = formatAuthHealth(metrics([0, 0], [0, 0], [0, 0]));
    expect(text).toContain('никто не пытался войти');
    expect(text).not.toMatch(/NaN|undefined|:\s*0/);
  });

  it('успехи есть, отказов нет — считает и хвалит числом, не молчит', () => {
    const text = formatAuthHealth(metrics([0, 0], [0, 0], [40, 260]));
    expect(text).toContain('За неделю вошли 260 раз, ни одного сбоя.');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('авария идёт прямо сейчас — прямо об этом и говорит, плюс доля успехов', () => {
    const text = formatAuthHealth(metrics([412, 0], [900, 0], [50, 100]));
    expect(text).toContain('Telegram: за сутки 412, за неделю 900');
    expect(text).toContain('открой приложение и проверь вход');
    // 100 успехов на 900 отказов + 100 успехов = 1000 попыток → 10%.
    expect(text).toContain('Успешных входов за неделю: 100 из 1000 (10%).');
  });

  it('площадка без отказов в строки не попадает', () => {
    const text = formatAuthHealth(metrics([0, 5], [0, 5], [0, 5]));
    expect(text).toContain('MAX: за сутки 5, за неделю 5');
    expect(text).not.toContain('Telegram:');
  });

  it('за неделю было, за сутки нет — отчёт замечает, что починено', () => {
    const text = formatAuthHealth(metrics([0, 0], [120, 0], [0, 500]));
    expect(text).toContain('Telegram: за сутки 0, за неделю 120');
    expect(text).toContain('похоже, уже починено');
  });

  it('язык простой: без англицизмов и служебных имён событий', () => {
    const text = formatAuthHealth(metrics([3, 0], [3, 0], [1, 10]));
    expect(text).not.toMatch(
      /auth_rejected|auth_success|empty_signature|initData|events?/i,
    );
  });
});
