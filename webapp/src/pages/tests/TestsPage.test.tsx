// @vitest-environment jsdom
// TestsPage (/tests) — публичный список мини-тестов. Мокаем useQuizzes,
// чтобы проверить три состояния: скелетон-загрузка (форма списка карточек,
// не спиннер — правило CLAUDE.md), ошибка API и готовый список со ссылками
// на конкретные тесты.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestsPage } from './TestsPage';
import type { QuizDto } from '../../api';

const mockUseQuizzes = vi.fn();
vi.mock('../../hooks/useQuizzes', () => ({
  useQuizzes: () => mockUseQuizzes(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <TestsPage />
    </MemoryRouter>,
  );
}

const QUIZ: QuizDto = {
  id: 'anger',
  emoji: '🔥',
  title: 'Какой ты в конфликте',
  teaser: 'Узнай свою реакцию',
  intro: 'Пара минут',
  questions: [{ text: 'Вопрос', options: [{ label: 'А', resultId: 'r1' }] }],
  results: [{ id: 'r1', emoji: '🔥', title: 'Итог', text: 'Текст', hint: 'Подсказка' }],
};

describe('TestsPage — состояние загрузки', () => {
  it('пока quizzes не пришли — показывает скелетон-карточки, а не спиннер', () => {
    mockUseQuizzes.mockReturnValue({ quizzes: null, error: false });
    renderPage();
    // Скелетон помечен aria-label — форма списка ещё до данных.
    expect(screen.getByLabelText('Тесты загружаются')).toBeTruthy();
  });
});

describe('TestsPage — ошибка API', () => {
  it('показывает читаемую ошибку с возможностью повторить, не пустой список', () => {
    mockUseQuizzes.mockReturnValue({ quizzes: null, error: true });
    renderPage();
    expect(screen.getByText(/Не получилось загрузить тесты/)).toBeTruthy();
  });
});

describe('TestsPage — список тестов', () => {
  it('рендерит карточку теста со ссылкой на его страницу и числом вопросов', () => {
    mockUseQuizzes.mockReturnValue({ quizzes: [QUIZ], error: false });
    renderPage();
    const link = screen.getByRole('link', { name: /Какой ты в конфликте/ });
    expect(link.getAttribute('href')).toBe('/tests/anger');
    expect(screen.getByText('1 вопросов · ~2 минуты')).toBeTruthy();
  });

  it('на пустом списке (аккаунт без тестов) не показывает выдуманных карточек', () => {
    mockUseQuizzes.mockReturnValue({ quizzes: [], error: false });
    renderPage();
    expect(screen.queryByRole('link', { name: /Какой ты/ })).toBeNull();
  });
});
