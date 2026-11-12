// @vitest-environment jsdom
// Проценты колеса потребностей на диаграмме: таблетка залита слева на процент
// выбранного периода и несёт число, переключатель периода меняет числа, а без
// единой оценки диаграмма рисуется как раньше — без заливки и переключателя.
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { buildConceptGraph } from '../conceptGraphModel';
import type { ConceptNeedLink } from '../needLinks';
import { RICH, source } from './diagram.test-helpers';
import { ConceptDiagram } from './ConceptDiagram';

const WHEEL: ConceptNeedLink[] = [
  { needId: 'attachment', ratings: { child: 2, teen: 3, now: 5 }, notes: {} },
  { needId: 'autonomy', ratings: { child: 0 }, notes: {} },
  { needId: 'play', ratings: {}, notes: { now: 'Играет с сыном' } },
];

const mount = (needLinks?: ConceptNeedLink[], readOnly = false) =>
  render(
    <ConceptDiagram
      graph={buildConceptGraph(source({ ...RICH, needLinks }), (ty) => ty)}
      edit={
        readOnly
          ? undefined
          : {
              openId: null,
              addOpen: null,
              panel: null,
              onOpenMode: () => {},
              onOpenSchema: () => {},
              onAdd: () => {},
            }
      }
    />,
  );

const pill = (needId: string) =>
  document.querySelector<HTMLButtonElement>(`[data-node="need:${needId}"]`)!;
const pct = (needId: string) =>
  pill(needId).querySelector('[data-need-pct]')?.textContent ?? null;
const fillWidth = (needId: string) =>
  pill(needId).querySelector<HTMLElement>('[data-need-fill] > span')?.style
    .width ?? null;
const periods = () =>
  screen.queryByRole('group', { name: 'Период оценок потребностей' });
const period = (name: string) =>
  within(periods()!).getByRole('button', { name });

describe('ConceptDiagram: проценты колеса потребностей', () => {
  it('оценённая таблетка залита слева на процент «Сейчас» и несёт число; подсказка — по всем периодам', () => {
    mount(WHEEL);
    expect(pct('attachment')).toBe('50%');
    expect(fillWidth('attachment')).toBe('50%');
    const title = 'Привязанность: детство 20%, 11–17 лет 30%, сейчас 50%';
    expect(pill('attachment').title).toBe(title);
    expect(screen.getByRole('button', { name: title })).toBe(
      pill('attachment'),
    );
    expect(period('Сейчас').getAttribute('aria-pressed')).toBe('true');
    expect(period('Детство').getAttribute('aria-pressed')).toBe('false');
  });

  it('потребность без оценки за период — без заливки и числа (не «0%»), оценённая нулём — «0%»', () => {
    mount(WHEEL);
    expect(pct('autonomy')).toBeNull();
    expect(fillWidth('autonomy')).toBeNull();
    expect(pct('play')).toBeNull();
    expect(pill('play').hasAttribute('title')).toBe(false);
    expect(screen.getByRole('button', { name: 'Спонтанность' })).toBe(
      pill('play'),
    );
    fireEvent.click(period('Детство'));
    expect(pct('autonomy')).toBe('0%');
    expect(fillWidth('autonomy')).toBe('0%');
  });

  it('переключатель периода меняет числа и заливку', () => {
    mount(WHEEL);
    fireEvent.click(period('Детство'));
    expect(pct('attachment')).toBe('20%');
    expect(fillWidth('attachment')).toBe('20%');
    expect(period('Детство').getAttribute('aria-pressed')).toBe('true');
    expect(period('Сейчас').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(period('11–17 лет'));
    expect(pct('attachment')).toBe('30%');
    expect(pct('autonomy')).toBeNull();
  });

  it('смена периода не снимает подсветку нажатой потребности и не зовёт её тап', () => {
    mount(WHEEL);
    fireEvent.click(pill('attachment'));
    fireEvent.click(period('Детство'));
    expect(pill('attachment').getAttribute('aria-pressed')).toBe('true');
  });

  it('«Сейчас» не оценено — диаграмма открывается на ближайшем оценённом периоде', () => {
    mount([WHEEL[1]]);
    expect(period('Детство').getAttribute('aria-pressed')).toBe('true');
    expect(pct('autonomy')).toBe('0%');
  });

  it('переключатель стоит внутри круга над его подписью и не накрывает таблетки; зона нажатия 44', () => {
    mount(WHEEL);
    const box = periods()!;
    const circle = document.querySelector('[data-needs-circle]')!;
    const top = parseFloat(box.style.top);
    const circleTop =
      Number(circle.getAttribute('cy')) - Number(circle.getAttribute('r'));
    expect(top).toBeGreaterThanOrEqual(circleTop);
    expect(top + 44).toBeLessThanOrEqual(
      parseFloat(pill('attachment').style.top),
    );
    for (const b of within(box).getAllByRole('button')) {
      expect(b.style.minHeight).toBe('44px');
      expect(b.style.minWidth).toBe('44px');
    }
  });

  it.each([
    ['колеса нет', undefined],
    ['колесо пустое', []],
    ['в колесе только текст листа', [WHEEL[2]]],
  ])('без оценок (%s) — ни переключателя, ни заливки, ни чисел', (_, links) => {
    mount(links);
    expect(periods()).toBeNull();
    expect(document.querySelector('[data-need-fill]')).toBeNull();
    expect(document.querySelector('[data-need-pct]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Привязанность' }).title).toBe(
      '',
    );
    expect(document.body.textContent).not.toMatch(/%|undefined|NaN/);
  });

  it('вид только для чтения рисует те же проценты, если колесо в модели есть', () => {
    mount(WHEEL, true);
    expect(pct('attachment')).toBe('50%');
    expect(pill('attachment').getAttribute('aria-pressed')).toBe('false');
  });
});
