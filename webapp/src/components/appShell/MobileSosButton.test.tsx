// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileSosButton } from './MobileSosButton';

afterEach(cleanup);

describe('MobileSosButton (C-К1)', () => {
  it('один тап открывает SOS-лист', () => {
    const onOpen = vi.fn();
    render(<MobileSosButton onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Мне плохо' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
