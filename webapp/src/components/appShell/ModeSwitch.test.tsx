// @vitest-environment jsdom
// Переключатель режима «Клиент · Терапевт» (#902): aria-pressed по value,
// onChange только при смене режима, модификатор светлого варианта для листа.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeSwitch } from './ModeSwitch';

afterEach(cleanup);

describe('ModeSwitch', () => {
  it('группа «Режим» с кнопками «Клиент» и «Терапевт»; aria-pressed и is-active — по value', () => {
    render(<ModeSwitch value variant="sidebar" onChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Режим' });
    const client = screen.getByRole('button', { name: 'Клиент' });
    const therapist = screen.getByRole('button', { name: 'Терапевт' });
    expect(group.contains(client) && group.contains(therapist)).toBe(true);
    expect(client.getAttribute('aria-pressed')).toBe('false');
    expect(therapist.getAttribute('aria-pressed')).toBe('true');
    expect(therapist.className).toContain('is-active');
    expect(client.className).not.toContain('is-active');
  });

  it('value=false: активен «Клиент»', () => {
    render(<ModeSwitch value={false} variant="sidebar" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Клиент' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Терапевт' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('«Клиент» из кабинета зовёт onChange(false), «Терапевт» из режима клиента — onChange(true)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ModeSwitch value variant="sheet" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Клиент' }));
    expect(onChange).toHaveBeenCalledWith(false);
    rerender(<ModeSwitch value={false} variant="sheet" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Терапевт' }));
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('клик по уже активному режиму onChange не зовёт', () => {
    const onChange = vi.fn();
    render(<ModeSwitch value variant="sheet" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Терапевт' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('вариант sheet — общий сегмент ds-seg, sidebar — sb-mode-switch', () => {
    const { rerender } = render(<ModeSwitch value variant="sheet" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Режим' }).className).toBe('ds-seg ds-seg--full');
    expect(screen.getByRole('button', { name: 'Клиент' }).className).toContain('ds-seg-btn');
    rerender(<ModeSwitch value variant="sidebar" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Режим' }).className).toBe('sb-mode-switch');
  });
});
