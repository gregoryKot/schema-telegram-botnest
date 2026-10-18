// @vitest-environment jsdom
// Этап 4 единой версии: фокус-карточка «Сегодня» на сайте. Проверяем связку
// «выбрал практику → сохранилось → CTA другой», «выполнено → на сегодня всё»,
// «Поделиться днём» и скрытие серии (флаг общий с мини-аппом, те же ключи).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';
import type { Need } from '../../types';
import { TodayFocusBlock } from './TodayFocusBlock';
import { StreakSlot } from './TodayAsideExtras';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn(), createSchemaDiary: vi.fn(), createModeDiary: vi.fn(), createGratitudeDiary: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
const track = api.trackEvent as unknown as ReturnType<typeof vi.fn>;

const NEEDS: Need[] = ['a', 'b'].map(id => ({ id, emoji: '🛡️', title: id, chartLabel: id }) as Need);
const NOTHING = { schema: false, mode: false, gratitude: false };

function data(over: Partial<{ todayDone: typeof NOTHING }> = {}) {
  return { todayDone: NOTHING, profile: null, gratitudeToday: undefined, reloadDiaries: vi.fn(), ...over } as never;
}

function renderBlock(opts: { ratings?: Record<string, number>; todayDone?: typeof NOTHING; form?: 'ty' | 'vy'; onOpenTracker?: () => void } = {}) {
  return render(
    <AddressFormContext.Provider value={{ form: opts.form ?? 'ty', setForm: vi.fn() }}>
      <MemoryRouter>
        <TodayFocusBlock
          needs={NEEDS}
          ratings={opts.ratings ?? {}}
          data={data(opts.todayDone ? { todayDone: opts.todayDone } : {})}
          onOpenTracker={opts.onOpenTracker ?? vi.fn()}
        />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => { localStorage.clear(); track.mockClear(); });
afterEach(cleanup);

describe('TodayFocusBlock — выбор практики', () => {
  it('по умолчанию трекер: главная кнопка открывает трекер', () => {
    const onOpenTracker = vi.fn();
    renderBlock({ onOpenTracker });
    fireEvent.click(screen.getByRole('button', { name: /Заполнить трекер потребностей/ }));
    expect(onOpenTracker).toHaveBeenCalled();
  });

  it('выбор практики сохраняется под ключом мини-аппа, меняет CTA и шлёт событие', () => {
    renderBlock();
    fireEvent.click(screen.getByText('Другая практика'));
    fireEvent.click(screen.getByRole('radio', { name: /Дневник режимов/ }));
    expect(localStorage.getItem('today_focus_practice')).toBe('mode');
    expect(screen.getByText('Отметить режим дня')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('today_focus_change', { practice: 'mode' });
  });

  it('сохранённая практика читается при монтировании (read-after-write)', () => {
    localStorage.setItem('today_focus_practice', 'gratitude');
    renderBlock();
    expect(screen.getByText('Три хорошие вещи')).toBeTruthy();
  });

  it('кнопка дневниковой практики открывает лист записи, а не трекер', async () => {
    localStorage.setItem('today_focus_practice', 'gratitude');
    const onOpenTracker = vi.fn();
    renderBlock({ onOpenTracker });
    fireEvent.click(screen.getByRole('button', { name: /Три хорошие вещи/ }));
    expect(onOpenTracker).not.toHaveBeenCalled();
    expect(await screen.findByText(/благодар/i, {}, { timeout: 3000 })).toBeTruthy();
  });
});

describe('TodayFocusBlock — на сегодня всё', () => {
  it('трекер: пока не все оценены — «Осталось», готового состояния нет', () => {
    renderBlock({ ratings: { a: 5 } });
    expect(screen.getByText(/Осталось 1 из 2/)).toBeTruthy();
    expect(screen.queryByText('На сегодня – всё')).toBeNull();
  });

  it('трекер: все оценены — «На сегодня – всё» с индексом дня', () => {
    renderBlock({ ratings: { a: 6, b: 8 } });
    expect(screen.getByText('На сегодня – всё')).toBeTruthy();
    expect(screen.getByText(/Индекс дня 7\.0\/10/)).toBeTruthy();
  });

  it('дневник: запись сегодня сделана — «На сегодня – всё» с подписью практики', () => {
    localStorage.setItem('today_focus_practice', 'schema');
    renderBlock({ todayDone: { ...NOTHING, schema: true } });
    expect(screen.getByText('На сегодня – всё')).toBeTruthy();
    expect(screen.getByText(/Запись в дневнике схем сделана/)).toBeTruthy();
    expect(screen.queryByText('Поделиться днём')).toBeNull();
  });

  it('обращение «вы» в подписи готового состояния', () => {
    renderBlock({ ratings: { a: 6, b: 8 }, form: 'vy' });
    expect(screen.getByText(/Загляните завтра/)).toBeTruthy();
    expect(screen.queryByText(/Загляни завтра/)).toBeNull();
  });

  it('«Поделиться днём» открывает лист с карточкой дня', () => {
    renderBlock({ ratings: { a: 6, b: 8 } });
    fireEvent.click(screen.getByText('Поделиться днём'));
    expect(screen.getByText('Карточка дня')).toBeTruthy();
  });
});

describe('StreakSlot — скрытие серии', () => {
  it('скрывает карточку общим флагом, шлёт событие и даёт вернуть', () => {
    render(<AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}><StreakSlot streak={4} /></AddressFormContext.Provider>);
    expect(screen.getByText('дней подряд')).toBeTruthy();
    fireEvent.click(screen.getByText('Скрыть'));
    expect(localStorage.getItem('today_streak_hidden')).toBe('1');
    expect(track).toHaveBeenCalledWith('today_block_toggle', { block: 'streak', hidden: true });
    expect(screen.queryByText('дней подряд')).toBeNull();
    fireEvent.click(screen.getByText('Показать серию дней'));
    expect(localStorage.getItem('today_streak_hidden')).toBeNull();
    expect(screen.getByText('дней подряд')).toBeTruthy();
  });

  it('уважает флаг, выставленный мини-аппом', () => {
    localStorage.setItem('today_streak_hidden', '1');
    render(<AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}><StreakSlot streak={4} /></AddressFormContext.Provider>);
    expect(screen.queryByText('дней подряд')).toBeNull();
  });
});
