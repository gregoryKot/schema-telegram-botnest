// @vitest-environment jsdom
// Правило №7 CLAUDE.md: дневник схем — эталон паттерна детекции
// (detectCrisisAny по всем свободнотекстовым полям + CrisisCard). Тестов на
// сам паттерн раньше не было — этот файл закрывает пробел.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaEntrySheet } from './SchemaEntrySheet';

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
  render(<SchemaEntrySheet onClose={() => {}} onSave={vi.fn()} />);
  return screen.getByPlaceholderText(
    'Что произошло? Где ты был/а, с кем, в какой момент?',
  );
}

describe('SchemaEntrySheet — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в любом свободном поле', () => {
    const trigger = renderSheet();
    fireEvent.change(trigger, { target: { value: 'не хочу жить' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    const trigger = renderSheet();
    fireEvent.change(trigger, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});
