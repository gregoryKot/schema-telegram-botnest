// @vitest-environment jsdom
// Правило №7 CLAUDE.md: ответ на шаге карточки (используется в
// Schema/ModeIntroSheet) — свободный текст, обязан проходить через
// кризисную детекцию. Компонент тестируется напрямую (не через шиты),
// контролируемое состояние ответа держит тестовая обёртка.
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { IntroSheetFlashcard } from './IntroSheetFlashcard';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

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
      step={0}
      totalSteps={1}
      question={{
        key: 'triggers',
        label: 'Что запускает эту схему?',
        hint: 'подсказка',
        placeholder: 'Когда не отвечают на сообщения...',
      }}
      answer={answer}
      onChange={setAnswer}
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
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('не показывает карточку при нейтральном ответе', () => {
    const textarea = renderCard();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });
});

describe('IntroSheetFlashcard — шаг виден сразу (правило онбординга)', () => {
  it('вопрос и поле ответа на экране без дополнительных нажатий', () => {
    render(<Wrapper />);
    expect(screen.getByText('Что запускает эту схему?')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Когда не отвечают на сообщения...'),
    ).toBeTruthy();
  });

  // Регрессия инцидента 2026-08: поле лежало внутри pressable-карточки,
  // и пробел из textarea уходил обёртке в preventDefault().
  it('пробел в поле ответа не перехватывается обёрткой', () => {
    const textarea = renderCard();
    const notPrevented = fireEvent.keyDown(textarea, {
      key: ' ',
      code: 'Space',
    });
    expect(notPrevented).toBe(true);
    fireEvent.change(textarea, { target: { value: 'два слова' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('два слова');
  });
});

// В7 дизайн-аудита 2026-08: вопрос был связан с полем только placeholder'ом,
// который исчезает при вводе. Проверяем, что поле доступно по видимому
// вопросу как по label — не только по placeholder.
describe('IntroSheetFlashcard — вопрос связан с полем (В7)', () => {
  it('textarea доступно по видимому вопросу как по label (не только по placeholder)', () => {
    render(<Wrapper />);
    // getByLabelText разрешает aria-labelledby так же, как <label for=…> —
    // падает, если поле не связано программно с видимым вопросом.
    const byLabel = screen.getByLabelText('Что запускает эту схему?');
    const byPlaceholder = screen.getByPlaceholderText(
      'Когда не отвечают на сообщения...',
    );
    expect(byLabel).toBe(byPlaceholder);
  });
});
