import { formatAdminStats, AdminStatsData } from './admin-stats.format';

const EMPTY: AdminStatsData = {
  today: '2026-07-26',
  totalUsers: 0,
  newUsers7: 0,
  newUsers30: 0,
  notifyOff: 0,
  blockedUsers: 0,
  todayCount: 0,
  fillRate: 0,
  week7Count: 0,
  activeCoreCount: 0,
  month30Count: 0,
  churnRisk: 0,
  ret1: 0,
  ret3: 0,
  ret7: 0,
  ret30: 0,
  lowestNeed: undefined,
  bestDow: 0,
  activePairs: 0,
};

describe('formatAdminStats', () => {
  // Правило №8: пустое состояние обязательно — на чистой БД без NaN/undefined.
  it('на пустых данных не показывает NaN/undefined/мусор', () => {
    const out = formatAdminStats(EMPTY);
    expect(out).not.toMatch(/NaN/);
    expect(out).not.toMatch(/undefined/);
    // Нет данных о потребностях → безопасная строка, а не «в среднем undefined».
    expect(out).toContain('Пока мало данных о потребностях');
    // Заголовок и дата на месте.
    expect(out).toContain('Что происходит в приложении');
    expect(out).toContain('2026-07-26');
    // Лучший день недели — валидный день (bestDow=0 → «вс»), не пусто.
    expect(out).toContain('Чаще всего заполняют: вс');
    // Активное ядро на пустой БД — честный «0 из 0», а не NaN/пропуск строки.
    expect(out).toContain(
      'Ведут дневник регулярно (хотя бы 3 дня из последних 7): 0 из 0 заходивших за неделю',
    );
  });

  it('форматирует населённый отчёт с метками потребностей и днём недели', () => {
    const out = formatAdminStats({
      ...EMPTY,
      totalUsers: 120,
      newUsers7: 8,
      newUsers30: 30,
      notifyOff: 5,
      blockedUsers: 3,
      todayCount: 42,
      fillRate: 35,
      week7Count: 60,
      activeCoreCount: 25,
      month30Count: 120,
      churnRisk: 7,
      ret1: 100,
      ret3: 70,
      ret7: 40,
      ret30: 12,
      lowestNeed: { needId: 'play', _avg: { value: 4.25 } },
      bestDow: 1,
    });
    expect(out).toContain('Всего людей: 120');
    expect(out).toContain('Заполнили сегодня: 42 (это 35%');
    // Активное ядро — подмножество недельных, оба числа читаются вместе.
    expect(out).toContain(
      'Ведут дневник регулярно (хотя бы 3 дня из последних 7): 25 из 60 заходивших за неделю',
    );
    expect(out).toContain('Могут уйти');
    expect(out).toContain('7'); // churnRisk
    // needId → человекочитаемая метка (play → Спонтанность) + округление до 0.1.
    expect(out).toContain('Спонтанность (в среднем 4.3 из 10)');
    expect(out).toContain('Чаще всего заполняют: пн'); // bestDow=1
    expect(out).not.toMatch(/NaN|undefined/);
  });

  it('неизвестный needId выводится как есть, без падения', () => {
    const out = formatAdminStats({
      ...EMPTY,
      lowestNeed: { needId: 'mystery', _avg: { value: 5 } },
    });
    expect(out).toContain('mystery (в среднем 5.0 из 10)');
  });
});
