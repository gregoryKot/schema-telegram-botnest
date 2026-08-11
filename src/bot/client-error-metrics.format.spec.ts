// Форматтер блока «Поломки на клиенте» для /stats. Пустое состояние проверяем
// обязательно (правило №8): на чистой БД отчёт не должен пугать нулями и
// «NaN», а когда авария реально идёт — обязан говорить прямо, и раздел
// «вход» не должен теряться среди остальных.
import { formatClientErrorMetrics } from './client-error-metrics.format';
import type { ClientErrorMetrics } from './client-error-metrics.format';

const empty: ClientErrorMetrics = {
  totalDay: 0,
  totalWeek: 0,
  authDay: 0,
  authWeek: 0,
  bySection: {
    today: 0,
    diary: 0,
    schemas: 0,
    practice: 0,
    profile: 0,
    help: 0,
    cabinet: 0,
    other: 0,
  },
  bySource: { webapp: 0, miniapp: 0 },
};

describe('formatClientErrorMetrics', () => {
  it('совсем чистая БД — «отчётов не было», а не «0» голым числом', () => {
    const text = formatClientErrorMetrics(empty);
    expect(text).toContain('ни разу не сообщило');
    expect(text).not.toMatch(/NaN|undefined|:\s*0\b/);
  });

  it('поломки есть, вход не ломался — считает и явно снимает подозрение со входа', () => {
    const text = formatClientErrorMetrics({
      ...empty,
      totalDay: 2,
      totalWeek: 10,
      bySection: { ...empty.bySection, diary: 10 },
      bySource: { webapp: 10, miniapp: 0 },
    });
    expect(text).toContain(
      'Приложение сообщило о поломке: 2 раз за сутки, 10 за неделю.',
    );
    expect(text).toContain('Вход ни разу не ломался на стороне приложения.');
    expect(text).toContain('Дневник — 10');
    expect(text).toContain('сайт — 10');
  });

  it('вход ломается — отдельная явная строка, не теряется среди разделов', () => {
    const text = formatClientErrorMetrics({
      totalDay: 40,
      totalWeek: 90,
      authDay: 35,
      authWeek: 80,
      bySection: { ...empty.bySection, other: 10 },
      bySource: { webapp: 0, miniapp: 90 },
    });
    expect(text).toContain(
      'Вход не срабатывал на телефоне у пользователя: 35 раз за сутки, 80 за неделю',
    );
    expect(text).toContain(
      'сломан на стороне приложения, а не у конкретного человека',
    );
  });

  it('раздел с нулём в список разделов не попадает', () => {
    const text = formatClientErrorMetrics({
      ...empty,
      totalDay: 0,
      totalWeek: 4,
      bySection: { ...empty.bySection, practice: 4 },
    });
    expect(text).toContain('Практики — 4');
    expect(text).not.toContain('Дневник —');
    expect(text).not.toContain('Помощь —');
  });

  it('разделы сортируются по убыванию — самый частый первым', () => {
    const text = formatClientErrorMetrics({
      ...empty,
      totalWeek: 15,
      bySection: { ...empty.bySection, diary: 2, cabinet: 9, profile: 4 },
    });
    const line = text.split('\n').find((l) => l.startsWith('По разделам'))!;
    expect(line.indexOf('Кабинет')).toBeLessThan(line.indexOf('Профиль'));
    expect(line.indexOf('Профиль')).toBeLessThan(line.indexOf('Дневник'));
  });

  it('источник без событий (0) не упоминается в строке «Откуда»', () => {
    const text = formatClientErrorMetrics({
      ...empty,
      totalWeek: 5,
      bySection: { ...empty.bySection, other: 5 },
      bySource: { webapp: 0, miniapp: 5 },
    });
    expect(text).toContain('приложение в мессенджере — 5');
    expect(text).not.toContain('сайт —');
  });

  it('язык простой: без англицизмов и служебных имён события', () => {
    const text = formatClientErrorMetrics({
      ...empty,
      totalDay: 1,
      totalWeek: 3,
      bySection: { ...empty.bySection, other: 3 },
    });
    expect(text).not.toMatch(/client_error|meta\.|event/i);
  });
});
