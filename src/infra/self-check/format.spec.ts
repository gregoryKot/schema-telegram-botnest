import { formatSelfCheck } from './format';
import { SelfCheckSnapshot } from './state';

const NOW = 1_700_000_000_000;

describe('formatSelfCheck', () => {
  it('пустая БД / ещё не запускалась — без 0/NaN/мусора', () => {
    const snap: SelfCheckSnapshot = { ranAt: null, results: [] };
    const text = formatSelfCheck(snap, NOW);
    expect(text).toContain('ещё не запускалась');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('всё в порядке — короткий текст без перечисления', () => {
    const snap: SelfCheckSnapshot = {
      ranAt: NOW - 5 * 60_000,
      results: [
        {
          id: 'db',
          title: 'База данных',
          critical: true,
          ok: true,
          detail: 'отвечает',
        },
        {
          id: 'telegram',
          title: 'Бот Telegram',
          critical: false,
          ok: true,
          detail: 'выключено',
        },
      ],
    };
    const text = formatSelfCheck(snap, NOW);
    expect(text).toContain('Всё в порядке');
    expect(text).toContain('5 мин назад');
    expect(text).not.toContain('•');
  });

  it('есть упавшие — перечисляет человеческое имя и деталь каждой', () => {
    const snap: SelfCheckSnapshot = {
      ranAt: NOW - 90 * 60_000,
      results: [
        {
          id: 'db',
          title: 'База данных',
          critical: true,
          ok: true,
          detail: 'отвечает',
        },
        {
          id: 'caldav',
          title: 'Личный календарь (iCloud)',
          critical: false,
          ok: false,
          detail: 'обнаружение не нашло ни одного календаря',
        },
      ],
    };
    const text = formatSelfCheck(snap, NOW);
    expect(text).toContain('Не в порядке');
    expect(text).toContain(
      '• Личный календарь (iCloud): обнаружение не нашло ни одного календаря',
    );
    expect(text).not.toContain('База данных:'); // только упавшие
    expect(text).toContain('2 ч назад');
  });

  it('давняя проверка — считает в днях, не в тысячах минут', () => {
    const snap: SelfCheckSnapshot = {
      ranAt: NOW - 3 * 24 * 3_600_000,
      results: [],
    };
    expect(formatSelfCheck(snap, NOW)).toContain('3 дн назад');
  });
});
