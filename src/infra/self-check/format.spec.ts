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
          ok: true,
          detail: 'отвечает',
          reportInHealth: true,
        },
        {
          id: 'telegram',
          title: 'Бот Telegram',
          ok: true,
          detail: 'выключено',
          reportInHealth: true,
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
          ok: true,
          detail: 'отвечает',
          reportInHealth: true,
        },
        {
          id: 'caldav',
          title: 'Личный календарь (iCloud)',
          ok: false,
          detail: 'обнаружение не нашло ни одного календаря',
          reportInHealth: true,
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

  it('зелёная проба с незаписанным ответом площадки — detail виден, «выключено» нет', () => {
    const entry = (id: string, title: string, detail: string) => ({
      id,
      title,
      ok: true,
      detail,
      reportInHealth: false,
    });
    const text = formatSelfCheck(
      {
        ranAt: NOW,
        results: [
          entry('postbox', 'Почта: Postbox', 'ключ принят (HTTP 400: X)'),
          entry('yandexOAuth', 'Вход через Яндекс', 'выключено'),
          entry('db', 'База данных', 'отвечает'),
        ],
      },
      NOW,
    );
    expect(text).toContain('Всё в порядке');
    expect(text).toContain('• Почта: Postbox: ключ принят (HTTP 400: X)');
    expect(text).not.toContain('Яндекс');
    expect(text).not.toContain('отвечает');
  });
});
