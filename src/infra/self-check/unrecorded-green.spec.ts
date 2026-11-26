import { unrecordedGreen } from './unrecorded-green';

const NOW = 1_700_000_000_000;

describe('unrecordedGreen', () => {
  it('зелёная проба с незаписанным ответом площадки — detail виден, «выключено» нет', () => {
    const entry = (id: string, title: string, detail: string) => ({
      id,
      title,
      ok: true,
      detail,
      reportInHealth: false,
    });
    const text = unrecordedGreen({
      ranAt: NOW,
      results: [
        entry('postbox', 'Почта: Postbox', 'ключ принят (HTTP 400: X)'),
        entry('yandexOAuth', 'Вход через Яндекс', 'выключено'),
        entry('db', 'База данных', 'отвечает'),
      ],
    });
    expect(text).toContain('• Почта: Postbox: ключ принят (HTTP 400: X)');
    expect(text).not.toContain('Яндекс');
    expect(text).not.toContain('отвечает');
  });

  it('нет таких проб — пустая строка', () => {
    expect(unrecordedGreen({ ranAt: NOW, results: [] })).toBe('');
  });
});
