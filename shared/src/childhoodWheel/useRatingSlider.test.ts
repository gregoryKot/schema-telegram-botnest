// @vitest-environment jsdom
// Клавиатура ползунка «Колеса детства» (QA 2026-11, З13) — одна на обе площадки.
import { createElement, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ratingKeyValue, useRatingSlider } from './useRatingSlider';

describe('ratingKeyValue', () => {
  it('неоценённая потребность: стрелки идут от середины, Enter и пробел ставят середину', () => {
    expect(ratingKeyValue('ArrowRight', undefined)).toBe(6);
    expect(ratingKeyValue('ArrowDown', undefined)).toBe(4);
    expect(ratingKeyValue('Enter', undefined)).toBe(5);
    expect(ratingKeyValue(' ', undefined)).toBe(5);
  });

  it('оценённая: шаг 1 стрелками, 2 страницей, края — Home/End, Enter не меняет', () => {
    expect(ratingKeyValue('ArrowUp', 7)).toBe(8);
    expect(ratingKeyValue('ArrowLeft', 7)).toBe(6);
    expect(ratingKeyValue('PageUp', 7)).toBe(9);
    expect(ratingKeyValue('PageDown', 7)).toBe(5);
    expect(ratingKeyValue('Home', 7)).toBe(0);
    expect(ratingKeyValue('End', 7)).toBe(10);
    expect(ratingKeyValue('Enter', 7)).toBe(7);
  });

  it('не выходит за 0–10 и не трогает чужие клавиши', () => {
    expect(ratingKeyValue('ArrowRight', 10)).toBe(10);
    expect(ratingKeyValue('PageDown', 1)).toBe(0);
    expect(ratingKeyValue('Tab', 3)).toBeNull();
    expect(ratingKeyValue('a', undefined)).toBeNull();
  });
});

// Сам хук — через настоящий элемент: роль и aria, клавиши, указатель.
function Track({
  initial,
  onChange = () => {},
}: {
  initial?: number;
  onChange?: (v: number) => void;
}) {
  const [value, setValue] = useState<number | undefined>(initial);
  const props = useRatingSlider({
    value,
    label: 'Безопасность',
    onChange: (v) => {
      setValue(v);
      onChange(v);
    },
  });
  return createElement('div', props);
}

function mountTrack(initial?: number) {
  const onChange = vi.fn();
  render(createElement(Track, { initial, onChange }));
  const el = screen.getByRole('slider', { name: 'Безопасность' });
  // jsdom не раскладывает: трек 0…100px, значит 10px — один шаг шкалы.
  el.getBoundingClientRect = () => ({
    left: 0,
    width: 100,
    top: 0,
    height: 10,
    right: 100,
    bottom: 10,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  el.setPointerCapture = vi.fn();
  return { el, onChange };
}

describe('useRatingSlider', () => {
  it('слайдер доступен: фокус, границы шкалы, «не оценено» до первого ввода', () => {
    const { el } = mountTrack();
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.getAttribute('aria-valuemax')).toBe('10');
    expect(el.getAttribute('aria-valuetext')).toBe('не оценено');
  });

  it('клавиатура: Enter ставит середину, стрелка двигает, чужая клавиша ничего не меняет', () => {
    const { el, onChange } = mountTrack();
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    fireEvent.keyDown(el, { key: 'Tab' });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([5, 6]);
    expect(el.getAttribute('aria-valuetext')).toBe('6 из 10');
  });

  it('указатель: нажатие ставит значение по месту, протяжка — только с зажатой кнопкой', () => {
    const { el, onChange } = mountTrack(2);
    fireEvent.pointerDown(el, { clientX: 72, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 31, buttons: 1 });
    fireEvent.pointerMove(el, { clientX: 95, buttons: 0 });
    fireEvent.pointerDown(el, { clientX: 500, pointerId: 1 });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([7, 3, 10]);
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
  });
});
