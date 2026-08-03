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
