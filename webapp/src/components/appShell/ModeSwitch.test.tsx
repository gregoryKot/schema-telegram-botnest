// @vitest-environment jsdom
// Переключатель режима «Клиент · Терапевт» (#902): вкладки LineTabs, aria-selected по value,
// onChange только при смене режима.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeSwitch } from './ModeSwitch';

afterEach(cleanup);

describe('ModeSwitch', () => {
  it('tablist «Режим» с вкладками «Клиент» и «Терапевт»; aria-selected — по value', () => {
    render(<ModeSwitch value variant="sidebar" onChange={() => {}} />);
    const list = screen.getByRole('tablist', { name: 'Режим' });
    const client = screen.getByRole('tab', { name: 'Клиент' });
    const therapist = screen.getByRole('tab', { name: 'Терапевт' });
    expect(list.contains(client) && list.contains(therapist)).toBe(true);
    expect(client.getAttribute('aria-selected')).toBe('false');
    expect(therapist.getAttribute('aria-selected')).toBe('true');
  });

  it('value=false: выбран «Клиент»', () => {
    render(<ModeSwitch value={false} variant="sidebar" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Клиент' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Терапевт' }).getAttribute('aria-selected')).toBe('false');
  });

  it('«Клиент» из кабинета зовёт onChange(false), «Терапевт» из режима клиента — onChange(true)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ModeSwitch value variant="sheet" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Клиент' }));
    expect(onChange).toHaveBeenCalledWith(false);
    rerender(<ModeSwitch value={false} variant="sheet" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Терапевт' }));
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('клик по уже выбранному режиму onChange не зовёт', () => {
    const onChange = vi.fn();
    render(<ModeSwitch value variant="sheet" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Терапевт' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sheet — общий .lt, sidebar — .lt.sb-mode-switch', () => {
    const { container, rerender } = render(<ModeSwitch value variant="sheet" onChange={() => {}} />);
    expect(container.firstElementChild!.className).toBe('lt');
    rerender(<ModeSwitch value variant="sidebar" onChange={() => {}} />);
    expect(container.firstElementChild!.className).toBe('lt sb-mode-switch');
  });
});
