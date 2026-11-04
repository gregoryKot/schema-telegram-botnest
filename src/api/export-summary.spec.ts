// «Сводка для терапевта» (QA 2026-11-03): на чистом аккаунте была
// «последние 0 дней … Серия: 1 дн.» — ноль в шапке и серия за открытие сайта.
import { buildExportSummary } from './export-summary';
import type { Need } from '../bot/bot.service';

const NEEDS = [
  { id: 'attachment', emoji: '🤝' },
  { id: 'autonomy', emoji: '🧭' },
] as Need[];

const NO_STREAK = { currentStreak: 0, longestStreak: 0, totalDays: 0 };

describe('buildExportSummary', () => {
  it('пустой аккаунт — честное «оценок нет», без нулевой серии и «0 дней»', () => {
    const text = buildExportSummary(NEEDS, [], NO_STREAK);
    expect(text).toContain('Оценок в трекере за эти дни нет.');
    expect(text).not.toMatch(/Серия/);
    expect(text).not.toMatch(/\b0 дн/);
  });

  it('дни с оценками — старые сверху, пропуск потребности — «–», числа склоняются', () => {
    const text = buildExportSummary(
      NEEDS,
      [
        { date: '2026-07-17', ratings: { attachment: 8 } },
        { date: '2026-07-16', ratings: { attachment: 5, autonomy: 6 } },
      ],
      { currentStreak: 1, longestStreak: 2, totalDays: 21 },
    );
    expect(text).toContain('за 30 дней заполнено 2 дня');
    expect(text.indexOf('2026-07-16')).toBeLessThan(text.indexOf('2026-07-17'));
    expect(text).toContain('2026-07-17: 🤝 8/10  🧭 –');
    expect(text).toContain('Серия: 1 день · Рекорд: 2 дня · Всего: 21 день');
  });

  it('записи только в дневниках — оценок нет, но серия честно показана', () => {
    const text = buildExportSummary(NEEDS, [], {
      currentStreak: 3,
      longestStreak: 5,
      totalDays: 5,
    });
    expect(text).toContain('Оценок в трекере за эти дни нет.');
    expect(text).toContain('Серия: 3 дня · Рекорд: 5 дней · Всего: 5 дней');
  });
});
