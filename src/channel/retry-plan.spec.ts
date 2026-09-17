// Кому досылать пост, вышедший не везде. Раньше такая площадка просто теряла
// публикацию: слот закрывался по первому успеху (частичный успех = «пост
// состоялся»), и до следующего слота с другой фразой ничего не происходило.
//
// Главное свойство под тестом — досылаем ТОЛЬКО должникам и только ту же
// фразу: повтор всего фан-аута дал бы дубль там, где пост уже вышел.
import { planRetry } from './retry-plan';
import type { DeliveryRow } from './delivery-log.format';

const row = (
  platform: string,
  ok: boolean,
  extra: Partial<DeliveryRow> = {},
): DeliveryRow => ({
  source: 'утро',
  platform,
  destination: '@ch',
  ok,
  reason: ok ? null : 'таймаут',
  text: 'фраза слота',
  createdAt: new Date(Date.UTC(2026, 7, 2, 7, 5)),
  ...extra,
});

describe('planRetry', () => {
  it('в план попадают только не принявшие площадки', () => {
    expect(
      planRetry([row('max', false), row('vk', true), row('telegram', true)]),
    ).toEqual({ text: 'фраза слота', platforms: ['max'] });
  });

  it('дошло везде — плана нет', () => {
    expect(planRetry([row('telegram', true), row('vk', true)])).toBeNull();
  });

  it('пустой журнал — плана нет', () => {
    expect(planRetry([])).toBeNull();
  });

  it('успешный повтор снимает долг: считаем последнюю запись площадки', () => {
    // Записи приходят новыми сверху.
    const rows = [
      row('max', true, { source: 'утро — повтор' }),
      row('max', false),
    ];
    expect(planRetry(rows)).toBeNull();
  });

  it('повтор снова не удался — площадка остаётся в долгу', () => {
    const rows = [
      row('max', false, { source: 'утро — повтор' }),
      row('max', false),
    ];
    expect(planRetry(rows)?.platforms).toEqual(['max']);
  });

  it('несколько должников попадают в один план — досылка идёт разом', () => {
    expect(
      planRetry([row('max', false), row('threads', false), row('vk', true)])
        ?.platforms,
    ).toEqual(['max', 'threads']);
  });

  it('без текста фразы досылать нечего — план пуст', () => {
    // Записи старше версии с колонкой text: повторить нечего, и выдумывать
    // новую фразу нельзя — на площадках должен оказаться тот же пост.
    expect(planRetry([row('max', false, { text: null })])).toBeNull();
  });

  it('текст берётся из журнала, а не из свежей записи повтора', () => {
    const rows = [
      row('max', false, { source: 'утро — повтор', text: 'фраза слота' }),
      row('max', false, { text: 'фраза слота' }),
    ];
    expect(planRetry(rows)?.text).toBe('фраза слота');
  });
});
