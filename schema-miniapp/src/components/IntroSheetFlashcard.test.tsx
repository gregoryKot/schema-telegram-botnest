// @vitest-environment jsdom
// Правило №7 CLAUDE.md: ответ на флэшкарте (используется в
// Schema/ModeIntroSheet) — свободный текст, обязан проходить через
// кризисную детекцию. Компонент тестируется напрямую (не через шиты),
// контролируемое состояние ответа держит тестовая обёртка.
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { IntroSheetFlashcard } from './IntroSheetFlashcard';

vi.mock('../api', () => ({
  api: { trackEvent: vi.fn() },
}));

afterEach(() => {
  cleanup();
});

function Wrapper() {
  const [answer, setAnswer] = useState('');
  return (
    <IntroSheetFlashcard
      accentColor="#a78bfa"
      step={0}
      totalSteps={1}
      question={{
        key: 'triggers',
        label: 'Что запускает эту схему?',
        hint: 'подсказка',
        placeholder: 'Когда не отвечают на сообщения...',
      }}
      answer={answer}
      flipped
      onFlip={() => {}}
      onUnflip={() => {}}
      onChange={setAnswer}
      answerPromptText="Нажми чтобы ответить"
    />
  );
}

function renderCard() {
  render(<Wrapper />);
  return screen.getByPlaceholderText('Когда не отвечают на сообщения...');
}

describe('IntroSheetFlashcard — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в ответе', () => {
    const textarea = renderCard();
    fireEvent.change(textarea, { target: { value: 'хочу исчезнуть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном ответе', () => {
    const textarea = renderCard();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});
