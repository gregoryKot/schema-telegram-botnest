// @vitest-environment jsdom
// Общий хук настройки «Сегодня»: связка действие → localStorage → следующий
// рендер (read-after-write), события аналитики с теми же именами, что у
// мини-аппа, и перечитывание после прихода серверных настроек.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTodayCustomization } from './useTodayCustomization';

const track = vi.fn();
const onChanged = vi.fn();
const setup = () => renderHook(() => useTodayCustomization({ track, onChanged }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('открытие листа', () => {
  it('кнопка открывает лист без подсветки и шлёт today_customize_open', () => {
    const { result } = setup();
    act(() => result.current.openByGear());
    expect(result.current.sheet).toBe(true);
    expect(result.current.highlight).toBeUndefined();
    expect(track).toHaveBeenCalledWith('today_customize_open', { via: 'gear' });
  });

  it('долгое нажатие открывает лист с подсветкой нужной строки', () => {
    const { result } = setup();
    act(() => result.current.openByHold('phrase'));
    expect(result.current.highlight).toBe('phrase');
    expect(track).toHaveBeenCalledWith('today_customize_open', {
      via: 'longpress',
    });
  });

  it('closeSheet закрывает лист', () => {
    const { result } = setup();
    act(() => result.current.openByGear());
    act(() => result.current.closeSheet());
    expect(result.current.sheet).toBeNull();
  });
});

describe('переключатели: сохранили → увидели в новом инстансе', () => {
  it.each([
    ['toggleStreak', 'streakHidden', 'streak', false],
    ['togglePhrase', 'phraseHidden', 'phrase', false],
    ['toggleTherapistBanner', 'therapistBannerHidden', 'therapist_banner', false],
    // «Что ещё можно сегодня» по умолчанию спрятано под сворачивание.
    ['toggleSecondary', 'secondaryHidden', 'secondary', true],
  ] as const)('%s', (action, flag, block, initial) => {
    const { result, unmount } = setup();
    expect(result.current[flag]).toBe(initial);
    act(() => result.current[action]());
    expect(result.current[flag]).toBe(!initial);
    expect(track).toHaveBeenCalledWith('today_block_toggle', {
      block,
      hidden: !initial,
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
    unmount();
    expect(setup().result.current[flag]).toBe(!initial);
  });
});

describe('выбор практики', () => {
  it('сохраняет практику, шлёт today_focus_change и просит синхронизацию', () => {
    const { result } = setup();
    act(() => result.current.choosePractice('gratitude'));
    expect(result.current.practice).toBe('gratitude');
    expect(localStorage.getItem('today_focus_practice')).toBe('gratitude');
    expect(track).toHaveBeenCalledWith('today_focus_change', {
      practice: 'gratitude',
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});

describe('порядок блоков (screen_order_today)', () => {
  it('по умолчанию — порядок реестра', () => {
    expect(setup().result.current.orderedIds).toEqual([
      'therapist_banner',
      'streak',
      'focus',
      'phrase',
      'secondary',
    ]);
  });

  it('reorder переставляет, пишет в тот же ключ, что мини-апп, и шлёт screen_block_move', () => {
    const { result } = setup();
    act(() => void result.current.reorder('phrase', 0));
    expect(result.current.orderedIds[0]).toBe('phrase');
    expect(JSON.parse(localStorage.getItem('screen_order_today') ?? '[]')[0]).toBe(
      'phrase',
    );
    expect(track).toHaveBeenCalledWith('screen_block_move', {
      screen: 'today',
      block: 'phrase',
      dir: 'up',
    });
    expect(setup().result.current.orderedIds[0]).toBe('phrase');
  });

  it('порядок, записанный мини-аппом, читается как есть', () => {
    localStorage.setItem('screen_order_today', '["phrase","focus"]');
    expect(setup().result.current.orderedIds.slice(0, 2)).toEqual([
      'phrase',
      'focus',
    ]);
  });
});
