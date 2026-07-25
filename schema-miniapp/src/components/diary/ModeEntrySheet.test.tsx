// @vitest-environment jsdom
// Правило №7 CLAUDE.md: дневник режимов прогоняет свободный текст через
// кризисную детекцию. С визардом (Slice 2) поле «ситуация» — первый шаг после
// выбора режима, поэтому преселектим режим через черновик.
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

// Преселект режима через черновик → визард открывается на шаге «ситуация».
function seedMode() {
  localStorage.setItem(
    'diary_draft_mode',
    JSON.stringify({
      startedAt: new Date().toISOString(),
      data: {
        modeId: 'vulnerable_child',
        situation: '',
        thoughts: '',
        feelings: '',
        bodyFeelings: '',
        actions: '',
        actualNeed: '',
        childhoodMemories: '',
      },
    }),
  );
}

function renderSheet() {
  seedMode();
  render(<ModeEntrySheet onClose={() => {}} onSave={vi.fn()} />);
  return screen.getByPlaceholderText(/позвонил папа/);
}

describe('ModeEntrySheet — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в поле «ситуация»', () => {
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
