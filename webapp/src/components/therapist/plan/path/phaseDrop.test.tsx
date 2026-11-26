// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { usePhaseDrop } from './phaseDrop';

function Zone({ onDropItem }: { onDropItem: (id: number) => void }) {
  const { props } = usePhaseDrop(onDropItem);
  return <div data-testid="z" {...props} />;
}
const dt = (data: Record<string, string>) => ({ types: Object.keys(data), getData: (t: string) => data[t], dropEffect: '' });

describe('usePhaseDrop', () => {
  it('чужой dataTransfer.types и нечисловой id ничего не вызывают', () => {
    const fn = vi.fn();
    render(<Zone onDropItem={fn} />);
    const z = screen.getByTestId('z');
    fireEvent.drop(z, { dataTransfer: dt({ 'text/plain': '1' }) });
    fireEvent.drop(z, { dataTransfer: dt({ 'application/plan-item': 'abc' }) });
    expect(fn).not.toHaveBeenCalled();
  });

  it('свой числовой id доходит до обработчика', () => {
    const fn = vi.fn();
    render(<Zone onDropItem={fn} />);
    fireEvent.drop(screen.getByTestId('z'), { dataTransfer: dt({ 'application/plan-item': '5' }) });
    expect(fn).toHaveBeenCalledWith(5);
  });
});
