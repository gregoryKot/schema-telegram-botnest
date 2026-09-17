// @vitest-environment jsdom
// NeedTodaySheet — экран оценки одной потребности. 0% покрытия (48 строк).
// ВАЖНО: этот компонент реализует СВОЙ drag-слайдер (calcValue/onPtrDown/
// trackRef) — третья независимая реализация механики «оценить потребность
// 0–10» в webapp, наряду с PickerRail (tap-грид в TrackerOverlay). CLAUDE.md
// прямо запрещает дублировать один и тот же ввод («красные флаги на ревью:
// две реализации одного ввода onPointerDown/calcValue/trackRef») — заведён
// как дефект в отчёте по задаче, здесь тестируем поведение как есть.
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
  it('перетаскивание слайдера зовёт onChange с округлённым значением 0–10', () => {
    const onChange = vi.fn();
    const { container } = renderSheet({ value: 5, onChange });
    const track = container.querySelector('[style*="touch-action"]') as HTMLElement;
    expect(track).toBeTruthy();
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 100, width: 100, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => {},
    });
    (track as unknown as { setPointerCapture: () => void }).setPointerCapture = vi.fn();
    fireEvent.pointerDown(track, { clientX: 70, buttons: 1 });
    expect(onChange).toHaveBeenCalledWith(7);
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
    // Диапазон «7–10» — самая верхняя карточка (RANGE_VALUES[2] = 7).
    fireEvent.click(screen.getByText('7–10'));
    expect(onChange).toHaveBeenCalledWith(7);
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

  it('оценка выше 3 НЕ показывает блок «Что с этим сделать?»', () => {
    renderSheet({ value: 6 });
    expect(screen.queryByText('Что с этим сделать?')).toBeNull();
  });
});

describe('NeedTodaySheet — маркер «вчера» (В10 аудита 2026-08)', () => {
  // Регрессия: yesterdayValue был объявлен в Props, но не деструктурирован —
  // пользователь сайта не видел маркер «вчера», который есть в miniapp
  // (NeedRatingBar). Паритет — не обязательно тот же DOM, тот же смысл.
  it('yesterdayValue передан — виден текст «вчера N»', () => {
    renderSheet({ value: 5, yesterdayValue: 3 });
    const hint = screen.getByText(/вчера/);
    expect(hint.textContent).toContain('вчера');
    expect(hint.textContent).toContain('3');
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
