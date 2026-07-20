// @vitest-environment jsdom
// Правило №7 CLAUDE.md: поле «что отзывается» на шаге Здорового Взрослого —
// свободный текст, обязано проходить через кризисную детекцию.
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ResponseStep } from './ResponseStep';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

afterEach(() => {
  cleanup();
});

function Wrapper() {
  const [reflection, setReflection] = useState('');
  return (
    <ResponseStep
      modeData={undefined}
      reflection={reflection}
      setReflection={setReflection}
      stepIndex={1}
      tr={(ty) => ty}
      onClose={() => {}}
      onBack={() => {}}
      onNext={() => {}}
    />
  );
}

function renderStep() {
  render(<Wrapper />);
  return screen.getByPlaceholderText('Что хочется сказать себе...');
}

describe('ResponseStep — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе', () => {
    const textarea = renderStep();
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    const textarea = renderStep();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});
