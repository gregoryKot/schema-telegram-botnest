// @vitest-environment jsdom
// NeedTodaySheet — экран оценки одной потребности. Ввод оценки — общая
// десятисегментная шкала NeedScale (та же, что на «Сегодня»): один компонент
// на всё приложение, тестируем здесь только подключение к листу.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { NeedTodaySheet } from './NeedTodaySheet';
import type { Need } from '../types';

vi.mock('../api', () => ({
  api: {
    getPractices: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({ notifyTimezone: 'UTC' }),
    addPractice: vi.fn(),
    createPlan: vi.fn(),
    trackEvent: vi.fn(),
  },
}));

HTMLElement.prototype.scrollIntoView = vi.fn();

const NEED: Need = { id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привязанность' };

function renderSheet(
  props: Partial<Parameters<typeof NeedTodaySheet>[0]> = {},
  form: 'ty' | 'vy' = 'ty',
) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <NeedTodaySheet need={NEED} value={5} onChange={vi.fn()} onClose={vi.fn()} {...props} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

afterEach(() => cleanup());

describe('NeedTodaySheet', () => {
  it('тап по ответу общей шкалы словами зовёт onChange с его значением', () => {
    const onChange = vi.fn();
    renderSheet({ value: 5, onChange });
    fireEvent.click(screen.getByRole('button', { name: /В основном да/ }));
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('текущая оценка показана словом, старая 1–10 — ближайшим', () => {
    renderSheet({ value: 5 });
    expect(screen.getAllByText('Наполовину').length).toBeGreaterThan(0);
  });

  it('раскрывающийся блок «Как это выглядит в жизни» показывает примеры из needData', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Как это выглядит в жизни'));
    // Хотя бы один пример потребности «привязанность» должен появиться.
    expect(screen.getAllByText('›').length).toBeGreaterThan(0);
  });

  it('блок «Как понять оценку» — клик по диапазону меняет значение (onChange)', () => {
    const onChange = vi.fn();
    renderSheet({ value: 5, onChange });
    fireEvent.click(screen.getByText('Как понять оценку'));
    // Диапазон «7–10» — самая верхняя карточка (RANGE_VALUES[2] = 8, «В основном да»).
    fireEvent.click(screen.getByText('7–10'));
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('низкая оценка (<=3) показывает CTA «Запланировать шаг на завтра» и открывает PlanSheet', async () => {
    await act(async () => { renderSheet({ value: 2 }); });
    expect(screen.getByText('Что с этим сделать?')).toBeTruthy();
    fireEvent.click(screen.getByText('Запланировать шаг на завтра'));
    // PlanSheet открылся — виден его собственный топбар «Назад».
    expect(screen.getByText('Один маленький шаг – и напомним')).toBeTruthy();
  });

  it('низкая оценка с onOpenHelp зовёт его и закрывает лист (goBack)', async () => {
    const onOpenHelp = vi.fn();
    await act(async () => { renderSheet({ value: 1, onOpenHelp }); });
    fireEvent.click(screen.getByText('Раздел Помощь'));
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('высокая оценка (=10) показывает поддерживающую подпись «Хороший день»', () => {
    renderSheet({ value: 10 });
    expect(screen.getByText(/Хороший день/)).toBeTruthy();
  });

  it('поддерживающая подпись звучит в форме «ты»', () => {
    renderSheet({ value: 10 }, 'ty');
    expect(screen.getByText('Хороший день – заметь это')).toBeTruthy();
  });

  it('поддерживающая подпись звучит в форме «вы»', () => {
    renderSheet({ value: 10 }, 'vy');
    expect(screen.getByText('Хороший день – заметьте это')).toBeTruthy();
  });

  it.each([
    [1, 0], [2, 0], [3, 0], [4, 0], [5, 1], [6, 1], [7, 2], [10, 2],
  ])('оценка %i подсвечивает карточку «Как понять оценку» №%i — по слову шкалы', (value, card) => {
    const { container } = renderSheet({ value });
    fireEvent.click(screen.getByText('Как понять оценку'));
    const cards = Array.from(container.querySelectorAll('.tk2-opt:not(.ds-card--hover)'));
    expect(cards.length).toBe(3);
    expect(cards.map(c => c.classList.contains('is-active'))).toEqual([0, 1, 2].map(i => i === card));
  });

  it('оценки нет — ни одна карточка не подсвечена', () => {
    const { container } = renderSheet({ value: 0 });
    fireEvent.click(screen.getByText('Как понять оценку'));
    expect(container.querySelectorAll('.tk2-opt:not(.ds-card--hover).is-active').length).toBe(0);
  });

  it('оценка выше 3 НЕ показывает блок «Что с этим сделать?»', () => {
    renderSheet({ value: 6 });
    expect(screen.queryByText('Что с этим сделать?')).toBeNull();
  });
});

describe('NeedTodaySheet — маркер «вчера» (В10 аудита 2026-08)', () => {
  // Регрессия: yesterdayValue был объявлен в Props, но не деструктурирован —
  // пользователь сайта не видел маркер «вчера», который есть в miniapp
  // (NeedRatingBar). Паритет — не обязательно тот же DOM, тот же смысл.
  it('yesterdayValue передан — на ближайшем слове стоит пометка «вчера»', () => {
    renderSheet({ value: 5, yesterdayValue: 3 });
    const marked = screen.getAllByRole('button').filter(b => b.textContent?.includes('вчера'));
    expect(marked.map(b => b.getAttribute('aria-label'))).toEqual(['Мало — 4 из 10']);
  });

  it('yesterdayValue не передан — текста «вчера» нет', () => {
    renderSheet({ value: 5 });
    expect(screen.queryByText(/вчера/)).toBeNull();
  });

  it('yesterdayValue=0 — текста «вчера» нет (нет оценки за вчера — не «оценка 0»)', () => {
    renderSheet({ value: 5, yesterdayValue: 0 });
    expect(screen.queryByText(/вчера/)).toBeNull();
  });
});
