// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedScalePanel } from './NeedScalePanel';

afterEach(cleanup);

const base = { hue: 28, label: 'Привязанность', onChange: vi.fn() };

describe('NeedScalePanel', () => {
  it('без оценки: число не показано, видна подсказка «ни одна цифра не выбрана»', () => {
    render(<NeedScalePanel {...base} value={0} />);
    expect(screen.getByText('ни одна цифра не выбрана')).toBeTruthy();
    expect(screen.queryByText('/10')).toBeNull();
  });

  it('с оценкой: число и дельта к вчера; клик по сегменту зовёт onChange', () => {
    const onChange = vi.fn();
    render(<NeedScalePanel {...base} onChange={onChange} value={5} delta={{ text: '↑2', up: true }} yesterday={3} />);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('вчера ↑2')).toBeTruthy();
    expect(screen.queryByText('ни одна цифра не выбрана')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '8 из 10' }));
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('без дельты текста «вчера» нет', () => {
    render(<NeedScalePanel {...base} value={5} delta={null} />);
    expect(screen.queryByText(/вчера/)).toBeNull();
  });
});
