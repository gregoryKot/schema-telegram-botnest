// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlusButton } from './PlusButton';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';

describe('PlusButton', () => {
  it('тап шлёт plus_open и открывает лист', () => {
    const onOpen = vi.fn();
    render(<PlusButton onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Быстрое действие' }));
    expect(api.trackEvent).toHaveBeenCalledWith('plus_open');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
