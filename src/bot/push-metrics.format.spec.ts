import { formatPushMetrics, type PushMetrics } from './push-metrics.format';

const quietWeek: PushMetrics['week'] = {
  enabled: 0,
  firstMissed: 0,
  disabled: 0,
  loggedOut: 0,
  denied: 0,
  gone: 0,
};

describe('formatPushMetrics', () => {
  it('пустая БД — одна строка без нулей и NaN', () => {
    const out = formatPushMetrics({ people: 0, devices: 0, week: quietWeek });
    expect(out).toBe(
      '🔔 <b>Уведомления в приложении</b>: пока никто не включал.',
    );
    expect(out).not.toMatch(/NaN|undefined|\b0\b/);
  });

  it('включены, за неделю тихо', () => {
    const out = formatPushMetrics({ people: 3, devices: 4, week: quietWeek });
    expect(out).toContain('Включены сейчас у 3 человек (устройств: 4).');
    expect(out).toContain('За неделю ничего не менялось.');
  });

  it('неделя с движением — язык без терминов, доли в скобках только когда есть', () => {
    const out = formatPushMetrics({
      people: 1,
      devices: 1,
      week: {
        enabled: 2,
        firstMissed: 1,
        disabled: 1,
        loggedOut: 1,
        denied: 3,
        gone: 1,
      },
    });
    expect(out).toContain('Включены сейчас у 1 человека');
    expect(out).toContain(
      'За неделю: включили 2 (первое не дошло у 1) · выключили 2 (из них при выходе из аккаунта 1) · запретили в браузере 3 · перестали доходить 1.',
    );
    expect(out).not.toMatch(/пуш|подписк|push/i);
  });

  it('сейчас ни у кого, но неделя была', () => {
    const out = formatPushMetrics({
      people: 0,
      devices: 0,
      week: { ...quietWeek, denied: 2 },
    });
    expect(out).toContain('Сейчас не включены ни у кого.');
    expect(out).toContain('включили 0 · выключили 0 · запретили в браузере 2');
  });
});
