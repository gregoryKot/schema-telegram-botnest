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

  it('площадки одного проекта названы по-русски, в порядке страницы', () => {
    const one = (keys: string[]) =>
      formatLinksPageMetrics({
        total30: keys.length,
        byTarget: Object.fromEntries(keys.map((k) => [k, 1])),
        byFrom: {},
      });
    expect(one(['project_max', 'project_tg'])).toContain(
      'Куда: «Всё по схеме» в Телеграме — 1, «Всё по схеме» в Макс — 1',
    );
    const ha = one(['ha_max', 'ha_vk', 'ha_threads', 'channel_ha']);
    expect(ha).toContain(
      'Куда: «Здоровый Взрослый» в Телеграме — 1, «Здоровый Взрослый» в Тредс — 1, ' +
        '«Здоровый Взрослый» во ВКонтакте — 1, «Здоровый Взрослый» в Макс — 1',
    );
    expect(one(['schema_max', 'channel_schema'])).toContain(
      'Куда: канал о схема-терапии в Телеграме — 1, канал о схема-терапии в Макс — 1',
    );
    expect(ha.replace(/<\/?b>/g, '')).not.toMatch(/[a-z]/i);
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
