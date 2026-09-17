// @vitest-environment jsdom
// Экран трекера: баннер кабинета терапевта (CLAUDE.md — приоритет покрытия
// «экраны трекера»). Поведение: клик открывает кабинет.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TherapistBanner } from './TherapistBanner';

afterEach(() => {
  cleanup();
});

describe('TherapistBanner', () => {
  it('показывает заголовок и клик вызывает onOpen', () => {
    const onOpen = vi.fn();
    render(<TherapistBanner onOpen={onOpen} />);
    expect(screen.getByText('Кабинет терапевта')).toBeTruthy();
    fireEvent.click(screen.getByText('Кабинет терапевта'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
