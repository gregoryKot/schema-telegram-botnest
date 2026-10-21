// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileScale } from './MobileScale';

afterEach(() => cleanup());

function setup(value: number, extra: Partial<Parameters<typeof MobileScale>[0]> = {}) {
  const onChange = vi.fn();
  render(<MobileScale value={value} hue={200} label="Привязанность" onChange={onChange} {...extra} />);
  return onChange;
}

describe('MobileScale', () => {
  it('без оценки показывает «—» и не рисует «/10»; «−» недоступен, «+» ставит 1', () => {
    const onChange = setup(0);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('/10')).toBeNull();
    expect((screen.getByLabelText('Меньше') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Больше'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('с оценкой показывает число и меняет её на ±1', () => {
    const onChange = setup(6);
    expect(screen.getByText('6')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Больше'));
    expect(onChange).toHaveBeenLastCalledWith(7);
    fireEvent.click(screen.getByLabelText('Меньше'));
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('на границах шкалы «+» на 10 и «−» на 1 заблокированы', () => {
    setup(10);
    expect((screen.getByLabelText('Больше') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    setup(1);
    expect((screen.getByLabelText('Меньше') as HTMLButtonElement).disabled).toBe(true);
  });

  it('тап по сегменту шкалы ставит это значение', () => {
    const onChange = setup(3);
    fireEvent.click(screen.getByLabelText('8 из 10'));
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('дельта к вчера видна только при выставленной оценке', () => {
    setup(5, { delta: { text: '+2', up: true } });
    expect(screen.getByText('вчера +2')).toBeTruthy();
    cleanup();
    setup(0, { delta: { text: '+2', up: true } });
    expect(screen.queryByText('вчера +2')).toBeNull();
  });
});
