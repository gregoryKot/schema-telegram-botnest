// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OtpCells } from './OtpCells';
import { normalizeOtp } from './otp';

afterEach(cleanup);

describe('normalizeOtp', () => {
  it('оставляет цифры и режет до шести', () => {
    expect(normalizeOtp('123 456')).toBe('123456');
    expect(normalizeOtp('12-34-56-78')).toBe('123456');
    expect(normalizeOtp('abc')).toBe('');
  });
});

describe('OtpCells', () => {
  it('рисует введённые цифры в ячейках и отдаёт очищенное значение', () => {
    const onChange = vi.fn();
    const { container } = render(<OtpCells value="48" onChange={onChange} disabled={false} label="Код" />);
    const cells = container.querySelectorAll('.al-cell');
    expect(cells).toHaveLength(6);
    expect(cells[0].textContent).toBe('4');
    expect(cells[2].classList.contains('is-active')).toBe(true);
    fireEvent.change(screen.getByLabelText('Код'), { target: { value: '482 913' } });
    expect(onChange).toHaveBeenCalledWith('482913');
  });
});
