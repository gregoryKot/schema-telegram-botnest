// @vitest-environment jsdom
// Правило №7 CLAUDE.md: дневник режимов использует тот же паттерн детекции,
// что и SchemaEntrySheet. Тестов на него раньше не было.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeEntrySheet } from './ModeEntrySheet';

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
  render(<ModeEntrySheet onClose={() => {}} onSave={vi.fn()} />);
  return screen.getByPlaceholderText(
    'Что произошло? Где ты, с кем, в какой момент?',
  );
}

describe('ModeEntrySheet — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в любом свободном поле', () => {
    const situation = renderSheet();
    fireEvent.change(situation, { target: { value: 'хочу умереть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    const situation = renderSheet();
    fireEvent.change(situation, {
      target: { value: 'сегодня гулял в парке' },
    });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});
