// @vitest-environment jsdom
// Ревью g2 r3 (major): «Динамика потребности» получала всю историю (~30 дней) и под подписью
// «За 7 дней» рисовала линию из ~21–30 точек, а «к предыдущей неделе» сравнивало три новых дня
// с тремя самыми старыми днями месяца; выбранный в ленте день не учитывался. Проверяем через шов:
// история 30 дней → «Неделя» → тап по потребности → линия листа = линия строки «Недели».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { HistoryView } from './HistoryView';
import { getNeedData } from '../needData';
import type { Need, DayHistory } from '../types';

vi.mock('../api', () => ({
  api: { getNote: vi.fn(async () => ({ text: null, tags: [] })), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
HTMLElement.prototype.scrollIntoView = vi.fn();

const NEEDS: Need[] = [{ id: 'attachment', emoji: '', title: 'Привязанность', chartLabel: 'Привяз.' }];
// 30 дней января 2020 (не «сегодня»), от новых к старым: эта неделя 8,7,8,9,8,7,8, прошлая — по 5,
// дальше — по 2. Старый расчёт дал бы «+5,7» (три новых против трёх первых дней месяца).
const WEEK = [8, 7, 8, 9, 8, 7, 8];
const score = (i: number) => (i < 7 ? WEEK[i] : i < 14 ? 5 : 2);
const history = (rate: (i: number) => number | null): DayHistory[] => Array.from({ length: 30 }, (_, i) => {
  const v = rate(i);
  return { date: `2020-01-${String(30 - i).padStart(2, '0')}`, ratings: v === null ? {} : { attachment: v } };
});

const d = (root: ParentNode, sel: string) => root.querySelector(sel)?.getAttribute('d') ?? '';
/** Одиночные дни — HTML-маркеры поверх svg (ревью g2 r5): их места «left/top» по порядку. */
const pts = (root: ParentNode, sel: string) =>
  [...root.querySelectorAll<HTMLElement>(sel)].map((el) => `${el.style.left}/${el.style.top}`);

async function openDynamics(h: DayHistory[], dayNum?: string, childhood = 3) {
  const utils = render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
      <MemoryRouter>
        <HistoryView needs={NEEDS} history={h} currentRatings={{}} childhoodRatings={{ attachment: childhood }} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
  await act(async () => {});
  if (dayNum) await act(async () => { fireEvent.click(screen.getByText(dayNum)); });
  fireEvent.click(screen.getByText('Неделя'));
  const row = utils.container.querySelector('.sd-spark-row')!;
  const rowLine = d(row, '.sd-spark-line');
  const rowPts = pts(row, '.sd-spark-pt');
  const rowGaps = d(row, '.sd-spark-gap');
  fireEvent.click(row); // по строке: имя потребности бывает и в карточке «внимание»
  const sheetLine = d(utils.container, '.tk2-line');
  return { rowLine, sheetLine, rowPts, sheetPts: pts(utils.container, '.tk2-pt'), rowGaps, sheetGaps: d(utils.container, '.tk2-gap') };
}

afterEach(() => cleanup());

describe('HistoryView → «Неделя» → «Динамика потребности»: одна неделя', () => {
  it('линия листа — путь строки «Недели», 7 точек; разница — эта неделя против прошлой', async () => {
    const { rowLine, sheetLine } = await openDynamics(history(score));
    expect(sheetLine).toBe(rowLine);
    expect(sheetLine.match(/[ML] /g)).toHaveLength(7);
    // (55/7 − 5) = 2,857 → «+2,9»
    expect(screen.getByText('+2,9 к предыдущей неделе')).toBeTruthy();
    expect(screen.getByText(/сейчас 7,7/)).toBeTruthy(); // три новых дня: (8+7+8)/3
  });

  it('выбранный в ленте день двигает неделю: неделя прошлого дня против недели до неё', async () => {
    const { rowLine, sheetLine } = await openDynamics(history(score), '23');
    expect(sheetLine).toBe(rowLine);
    expect(screen.getByText('+3,0 к предыдущей неделе')).toBeTruthy();
  });

  it('пропуски: линия рвётся одинаково в обоих местах, «сейчас» не занижено', async () => {
    const r = await openDynamics(history((i) => (i === 3 || i === 5 ? null : score(i))));
    expect(r.sheetLine).toBe(r.rowLine);
    // Неделя 8,7,8,–,8,–,8 (от новых): отрезок из трёх дней — линией, два одиночных — точками.
    expect(r.sheetLine.match(/M /g)).toHaveLength(1);
    expect(r.sheetPts).toEqual(r.rowPts);
    expect(r.sheetPts).toHaveLength(2);
    expect(screen.getByText(/сейчас 7,7/)).toBeTruthy(); // три новых дня с оценкой: (8+7+8)/3
  });

  // Ревью g2 r4: отметки через день давали одиночные дни — отрезки нулевой длины точкой в 2px, «Неделя»
  // и «Динамика» читались пустыми. Каждый день с оценкой виден: в отрезке — изломом линии, одиночный —
  // точкой (HTML-маркер .sd-spark-pt / .tk2-pt), через пропуск — тихий пунктирный мостик без значения.
  it('история через день: точка на каждый день с оценкой, мостики через пропуски — одинаково в строке и листе', async () => {
    const r = await openDynamics(history((i) => (i % 2 ? null : score(i))));
    expect(r.rowLine).toBe('');
    expect(r.rowPts).toHaveLength(4); // дни 0, 2, 4, 6 недели
    expect(r.sheetPts).toEqual(r.rowPts);
    expect(document.querySelector('svg path[d*="L"][class$="pts"]')).toBeNull(); // не отрезки нулевой длины
    expect(r.rowGaps.match(/M /g)).toHaveLength(3);
    expect(r.sheetGaps).toBe(r.rowGaps);
  });

  // Ревью g2 r4: «сейчас» стало средним недели — на 2,2,2,6,6,6,6 при детстве 2 лист писал «↓ Падает» и
  // «сейчас 4,3 ↑», хотя линия легла на пунктир детства.
  // Ревью g2 r6: совет «Попробуй сегодня» под графиком случаен, а в пуле low у «Привязанности» есть
  // советы со словом «сейчас» — голый getByText(/сейчас/) ловил два элемента в ~13% прогонов. Прибиваем
  // худший случай (совет со «сейчас») и ищем саму строку сравнения с детством, а не слово на экране.
  it('падает к детству: «сейчас» — три новых дня, без стрелки «выше детства»', async () => {
    const low = getNeedData('ty').attachment.tips.low;
    const withNow = low.findIndex((t) => t.includes('сейчас'));
    expect(withNow).toBeGreaterThanOrEqual(0);
    const rnd = vi.spyOn(Math, 'random').mockReturnValue((withNow + 0.5) / low.length);
    try {
      const falling = [2, 2, 2, 6, 6, 6, 6];
      await openDynamics(history((i) => (i < 7 ? falling[i] : null)), undefined, 2);
      expect(screen.getByText('↓ Падает')).toBeTruthy();
      expect(document.querySelector('.tk2-tip-text')!.textContent).toContain('сейчас');
      const now = document.querySelector('.tk2-child-now');
      expect(now?.textContent?.trim()).toBe('→ сейчас 2,0');
    } finally {
      rnd.mockRestore();
    }
  });

  it('один день истории — без «+0,0 к предыдущей неделе»', async () => {
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <HistoryView needs={NEEDS} history={history(score).slice(0, 1)} currentRatings={{}} />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    await act(async () => {});
    fireEvent.click(screen.getByText('Неделя'));
    fireEvent.click(screen.getByText('Привяз.'));
    expect(screen.getByText('Динамика')).toBeTruthy();
    expect(screen.queryByText(/к предыдущей неделе/)).toBeNull();
  });
});
