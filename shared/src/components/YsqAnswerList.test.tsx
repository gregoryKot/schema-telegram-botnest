// @vitest-environment jsdom
// Список ответов вопроса теста на схемы — один контрол для обоих фронтендов.
// Поведение: рендерит все варианты, выбор трекает onSelect(value), выбранный
// подсвечивается — не завязываемся на конкретные inline-стили webapp/miniapp.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { YsqAnswerList } from './YsqAnswerList';
import { ANSWER_LABELS } from '../hooks/useYsqTest';

afterEach(() => {
  cleanup();
});

describe('YsqAnswerList', () => {
  it('рендерит все варианты ответов (ANSWER_LABELS)', () => {
    render(
      <YsqAnswerList
        currentAnswer={0}
        onSelect={vi.fn()}
        unselectedBg="transparent"
        radioColor="var(--accent)"
      />,
    );
    for (const label of ANSWER_LABELS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('клик по варианту зовёт onSelect с 1-based значением', () => {
    const onSelect = vi.fn();
    render(
      <YsqAnswerList
        currentAnswer={0}
        onSelect={onSelect}
        unselectedBg="transparent"
        radioColor="var(--accent)"
      />,
    );
    fireEvent.click(screen.getByText(ANSWER_LABELS[2]));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('currentAnswer помечает соответствующую кнопку выбранной (aria через стиль border)', () => {
    render(
      <YsqAnswerList
        currentAnswer={1}
        onSelect={vi.fn()}
        unselectedBg="transparent"
        radioColor="var(--accent)"
      />,
    );
    const selectedButton = screen
      .getByText(ANSWER_LABELS[0])
      .closest('button')!;
    expect(selectedButton.style.border).toContain('var(--accent)');
  });
});
