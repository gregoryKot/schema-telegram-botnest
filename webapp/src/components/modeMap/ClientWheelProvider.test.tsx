// @vitest-environment jsdom
// Колесо потребностей на карте у клиента: оценки приходят с картой (needRatings), узел тот же,
// что у терапевта. Заметки листа до узла не доходят; нет оценки — «—», а не ноль.
import { describe, it, expect, beforeEach } from 'vitest';
import { installFlowTestPolyfills, renderWithFlow } from '../../test-support/renderWithFlow';
import { ClientWheelProvider } from './ClientWheelProvider';
import { clientWheelLinks } from './clientWheelLinks';
import { NeedWheelNode } from './NeedWheelNode';

describe('clientWheelLinks', () => {
  it('оценки периодов доходят до колеса как есть', () => {
    expect(clientWheelLinks([{ needId: 'attachment', ratings: { child: 2, now: 7 } }]))
      .toEqual([{ needId: 'attachment', ratings: { child: 2, now: 7 }, notes: {} }]);
  });

  it('заметки листа, пришедшие в сыром ответе, отброшены', () => {
    const [link] = clientWheelLinks([{ needId: 'play', ratings: { now: 3 }, notes: { now: 'Мало игры' } }]);
    expect(link).toEqual({ needId: 'play', ratings: { now: 3 }, notes: {} });
  });

  it('потребность без единой оценки в колесо не попадает', () => {
    expect(clientWheelLinks([{ needId: 'play', ratings: {}, notes: { now: 'Мало игры' } }, { needId: 'limits' }])).toEqual([]);
  });

  it('не массив, мусор внутри и отсутствие поля — пустое колесо', () => {
    for (const raw of [undefined, null, 'x', { needId: 'play' }, [null, 5, { needId: 'чужая', ratings: { now: 3 } }, { needId: 'play', ratings: { now: 11 } }]]) {
      expect(clientWheelLinks(raw)).toEqual([]);
    }
  });
});

type Data = Parameters<typeof NeedWheelNode>[0]['data'];
const view = (wheel: NonNullable<Data['wheel']>): Data => ({ label: 'Базовые эмоциональные потребности', wheel });
const renderWheel = (ratings: unknown, data: Data = view({ period: 'now' })) =>
  renderWithFlow(<ClientWheelProvider ratings={ratings}><NeedWheelNode id="w" data={data} /></ClientWheelProvider>).container;
const sector = (c: HTMLElement, id: string) => c.querySelector(`button[data-need="${id}"]`)!.textContent;

describe('ClientWheelProvider — колесо клиента на узле карты', () => {
  beforeEach(() => { installFlowTestPolyfills(); });

  it('оценка выбранного периода стоит у сектора процентом', () => {
    const c = renderWheel([{ needId: 'attachment', ratings: { now: 7, child: 2 } }]);
    expect(sector(c, 'attachment')).toContain('70%');
    expect(sector(c, 'play')).toContain('—');
  });

  it('сравнение с детством: контур рисуется от детских оценок и подписан', () => {
    const c = renderWheel([{ needId: 'attachment', ratings: { now: 7, child: 2 } }], view({ period: 'now', compare: true }));
    expect(c.querySelector('[data-layer="childhood"]')).not.toBeNull();
    expect(c.textContent).toContain('контур — детство');
  });

  it('оценок нет (пустой массив или поля нет в ответе) — «—», а не «0%»', () => {
    for (const ratings of [[], undefined]) {
      const c = renderWheel(ratings);
      expect(sector(c, 'attachment')).toContain('—');
      expect(c.textContent).not.toContain('%');
    }
  });

  it('ноль — это оценка: «0%», а не «—»', () => {
    const c = renderWheel([{ needId: 'limits', ratings: { now: 0 } }]);
    expect(sector(c, 'limits')).toContain('0%');
    expect(sector(c, 'limits')).not.toContain('—');
  });
});
