// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateField } from './DateField';

describe('DateField', () => {
  it('подпись — дата словами, выбор в календаре уходит в onChange значением YYYY-MM-DD', () => {
    const onChange = vi.fn();
    const { container } = render(<DateField label="Дата заметки" value="2020-11-26" onChange={onChange} />);
    expect(container.textContent).toBe('26 ноября 2020');
    fireEvent.change(screen.getByLabelText('Дата заметки'), { target: { value: '2020-11-20' } });
    expect(onChange).toHaveBeenCalledWith('2020-11-20');
  });
});
