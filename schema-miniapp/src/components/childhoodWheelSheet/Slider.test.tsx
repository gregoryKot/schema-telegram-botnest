// @vitest-environment jsdom
// Slider — общий контрол «оценить 0..10» колеса детства (0% покрытия,
// правило «одна механика — один компонент»: единственная реализация этого
// жеста в приложении). Проверяем расчёт значения по позиции указателя
// (pointerdown/pointermove) и клэмп границ 0..10.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';

afterEach(cleanup);

// jsdom не считает реальную геометрию — подменяем getBoundingClientRect
// фиксированным прямоугольником 0..100px, чтобы доля по X была предсказуема.
function mockRect(el: Element) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 100,
    width: 100,
    top: 0,
    bottom: 20,
    height: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('Slider — расчёт значения по указателю', () => {
  it('pointerdown в середине трека (x=50 из 100) — value≈5', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider value={0} color="#a78bfa" onChange={onChange} />,
    );
    const track = container.firstElementChild as HTMLElement;
    mockRect(track);
    track.setPointerCapture = vi.fn();
    fireEvent.pointerDown(track, { clientX: 50, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('клик у левого края — value=0 (клэмп снизу)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider value={5} color="#a78bfa" onChange={onChange} />,
    );
    const track = container.firstElementChild as HTMLElement;
    mockRect(track);
    track.setPointerCapture = vi.fn();
    fireEvent.pointerDown(track, { clientX: -50, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('клик правее трека — value=10 (клэмп сверху)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider value={5} color="#a78bfa" onChange={onChange} />,
    );
    const track = container.firstElementChild as HTMLElement;
    mockRect(track);
    track.setPointerCapture = vi.fn();
    fireEvent.pointerDown(track, { clientX: 999, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('pointermove с зажатой кнопкой (buttons=1) тоже обновляет значение', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider value={0} color="#a78bfa" onChange={onChange} />,
    );
    const track = container.firstElementChild as HTMLElement;
    mockRect(track);
    fireEvent.pointerMove(track, { clientX: 20, buttons: 1 });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('pointermove без нажатой кнопки (buttons=0) — движение мыши без клика не двигает значение', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider value={0} color="#a78bfa" onChange={onChange} />,
    );
    const track = container.firstElementChild as HTMLElement;
    mockRect(track);
    fireEvent.pointerMove(track, { clientX: 20, buttons: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

// В9 дизайн-аудита 2026-08: слайдер был чисто pointer-based, недоступен с
// клавиатуры полностью. role="slider" + aria-value* + стрелки.
describe('Slider — клавиатура (В9)', () => {
  function renderSlider(value: number, onChange = vi.fn()) {
    const { container } = render(
      <Slider
        value={value}
        color="#a78bfa"
        onChange={onChange}
        label="Привязанность"
      />,
    );
    return { track: container.firstElementChild as HTMLElement, onChange };
  }

  it('role=slider с корректными aria-value*', () => {
    const { track } = renderSlider(4);
    expect(track.getAttribute('role')).toBe('slider');
    expect(track.getAttribute('aria-valuemin')).toBe('0');
    expect(track.getAttribute('aria-valuemax')).toBe('10');
    expect(track.getAttribute('aria-valuenow')).toBe('4');
    expect(track.getAttribute('aria-valuetext')).toBe('4 из 10');
    expect(track.getAttribute('aria-label')).toBe('Привязанность');
    expect(track.tabIndex).toBe(0);
  });

  it('ArrowRight/ArrowUp увеличивают значение на 1', () => {
    const { track, onChange } = renderSlider(4);
    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(5);
    fireEvent.keyDown(track, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('ArrowLeft/ArrowDown уменьшают значение на 1', () => {
    const { track, onChange } = renderSlider(4);
    fireEvent.keyDown(track, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.keyDown(track, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('PageUp/PageDown меняют значение на 2', () => {
    const { track, onChange } = renderSlider(4);
    fireEvent.keyDown(track, { key: 'PageUp' });
    expect(onChange).toHaveBeenCalledWith(6);
    fireEvent.keyDown(track, { key: 'PageDown' });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('Home/End переводят в края диапазона', () => {
    const { track, onChange } = renderSlider(4);
    fireEvent.keyDown(track, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(0);
    fireEvent.keyDown(track, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('клэмп: ArrowRight на value=10 не превышает максимум', () => {
    const { track, onChange } = renderSlider(10);
    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('клэмп: ArrowLeft на value=0 не уходит ниже минимума', () => {
    const { track, onChange } = renderSlider(0);
    fireEvent.keyDown(track, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
