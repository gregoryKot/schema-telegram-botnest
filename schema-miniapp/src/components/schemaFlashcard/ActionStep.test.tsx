// @vitest-environment jsdom
// Правило №7 CLAUDE.md: поле «маленький шаг» — свободный текст, обязано
// проходить через кризисную детекцию.
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ActionStep } from './ActionStep';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

afterEach(() => {
  cleanup();
});

function Wrapper() {
  const [action, setAction] = useState('');
  return (
    <ActionStep
      selectedNeed={null}
      action={action}
      setAction={setAction}
      stepIndex={3}
      tr={(ty) => ty}
      onClose={() => {}}
      onBack={() => {}}
      onSave={() => {}}
    />
  );
}

function renderStep() {
  render(<Wrapper />);
  return screen.getByPlaceholderText(
    'Написать другу, выйти подышать, обнять подушку...',
  );
}

describe('ActionStep — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе', () => {
    const textarea = renderStep();
    fireEvent.change(textarea, { target: { value: 'хочу умереть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    const textarea = renderStep();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});
