// Форматтер блока «Страница ссылок» в /stats: полные данные и пустая БД,
// язык без терминов (правило №8).
import { formatLinksPageMetrics } from './links-page-metrics.format';

describe('formatLinksPageMetrics', () => {
  it('полные данные: итог, кнопки и источники по-русски, нули скрыты', () => {
    const text = formatLinksPageMetrics({
      total30: 12,
      byTarget: { booking: 5, project: 4, write: 3, articles: 0 },
      byFrom: { telegram: 6, instagram: 2, direct: 3, other: 1 },
    });
    expect(text).toContain('Страница ссылок');
    expect(text).toContain('Нажали на кнопки: 12');
    expect(text).toContain(
      'Куда: запись на консультацию — 5, «Всё по схеме» — 4, написать лично — 3',
    );
    expect(text).toContain(
      'Откуда пришли: Телеграм — 6, Инстаграм — 2, другая метка — 1, без метки — 3',
    );
    // Язык без терминов: сырых ключей события в отчёте нет.
    expect(text.replace(/<\/?b>/g, '')).not.toMatch(/[a-z]/i);
    expect(text).not.toContain('статьи');
  });

  it('пустая БД: дружелюбная строка, без NaN и нулей', () => {
    const text = formatLinksPageMetrics({
      total30: 0,
      byTarget: {},
      byFrom: {},
    });
    expect(text).toContain('Пока никто не нажимал');
    expect(text).not.toMatch(/NaN|undefined|: 0/);
  });
});
