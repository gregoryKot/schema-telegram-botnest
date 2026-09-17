// @vitest-environment jsdom
// Профиль: вход в архив «Мой путь» (CLAUDE.md — приоритет покрытия
// «профиль/статистика», правило онбординга «откуда это и зачем» — карточка
// объясняет назначение прямо на месте). Поведение: клик открывает архив.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { JourneyEntryCard } from './JourneyEntryCard';

afterEach(() => {
  cleanup();
});

describe('JourneyEntryCard', () => {
  it('объясняет, что это, и клик по карточке вызывает onOpen', () => {
    const onOpen = vi.fn();
    render(<JourneyEntryCard onOpen={onOpen} />);
    expect(screen.getByText('Мой путь')).toBeTruthy();
    expect(screen.getByText(/трекер, дневники, практики и тесты/)).toBeTruthy();
    fireEvent.click(screen.getByText('Мой путь'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
