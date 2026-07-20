// @vitest-environment jsdom
// Правило №7 CLAUDE.md: дневник благодарности — свободнотекстовые пункты,
// тот же паттерн детекции. Тестов на него раньше не было.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GratitudeEntrySheet } from './GratitudeEntrySheet';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function renderSheet() {
  render(
    <GratitudeEntrySheet
      onClose={() => {}}
      date="2026-07-20"
      existingItems={['', '', '']}
      onSave={vi.fn()}
    />,
  );
  return screen.getByPlaceholderText(
    'Что-то хорошее, что произошло сегодня...',
  );
}

describe('GratitudeEntrySheet — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в одном из пунктов', () => {
    const first = renderSheet();
    fireEvent.change(first, { target: { value: 'хочу исчезнуть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    const first = renderSheet();
    fireEvent.change(first, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});
