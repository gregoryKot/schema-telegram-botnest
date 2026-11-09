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

async function openDynamics(h: DayHistory[], dayNum?: string) {
  const utils = render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
      <MemoryRouter>
        <HistoryView needs={NEEDS} history={h} currentRatings={{}} childhoodRatings={{ attachment: 3 }} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
  await act(async () => {});
  if (dayNum) await act(async () => { fireEvent.click(screen.getByText(dayNum)); });
  fireEvent.click(screen.getByText('Неделя'));
  const rowLine = utils.container.querySelector('.sd-spark-row .sd-spark-line')!.getAttribute('d')!;
  fireEvent.click(screen.getByText('Привяз.'));
  const sheetLine = utils.container.querySelector('.tk2-line')!.getAttribute('d')!;
  return { rowLine, sheetLine };
}

afterEach(() => cleanup());

describe('HistoryView → «Неделя» → «Динамика потребности»: одна неделя', () => {
  it('линия листа — путь строки «Недели», 7 точек; разница — эта неделя против прошлой', async () => {
    const { rowLine, sheetLine } = await openDynamics(history(score));
    expect(sheetLine).toBe(rowLine);
    expect(sheetLine.match(/[ML] /g)).toHaveLength(7);
    // (55/7 − 5) = 2,857 → «+2,9»
    expect(screen.getByText('+2,9 к предыдущей неделе')).toBeTruthy();
    expect(screen.getByText(/сейчас 7,9/)).toBeTruthy();
  });

  it('выбранный в ленте день двигает неделю: неделя прошлого дня против недели до неё', async () => {
    const { rowLine, sheetLine } = await openDynamics(history(score), '23');
    expect(sheetLine).toBe(rowLine);
    expect(screen.getByText('+3,0 к предыдущей неделе')).toBeTruthy();
  });

  it('пропуски: линия рвётся одинаково в обоих местах, «сейчас» не занижено', async () => {
    const { rowLine, sheetLine } = await openDynamics(history((i) => (i === 3 || i === 5 ? null : score(i))));
    expect(sheetLine).toBe(rowLine);
    expect(sheetLine.match(/M /g)).toHaveLength(3);
    expect(screen.getByText(/сейчас 7,8/)).toBeTruthy(); // (8+7+8+8+8)/5
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
