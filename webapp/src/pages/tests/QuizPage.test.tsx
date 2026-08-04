// @vitest-environment jsdom
// QuizPage (/tests/:quizId) — прохождение мини-теста без регистрации.
// Мокаем useQuizzes и api.trackPublicEvent; useQuizRunner оставляем живым,
// чтобы тест бил по реальной связке «ответил на все вопросы → результат».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QuizPage } from './QuizPage';
import type { QuizDto } from '../../api';

const mockUseQuizzes = vi.fn();
vi.mock('../../hooks/useQuizzes', () => ({
  useQuizzes: () => mockUseQuizzes(),
}));

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api');
  return { ...actual, api: { ...actual.api, trackPublicEvent: vi.fn() } };
});
import { api } from '../../api';
const trackMock = api.trackPublicEvent as unknown as ReturnType<typeof vi.fn>;

const QUIZ: QuizDto = {
  id: 'anger',
  emoji: '🔥',
  title: 'Какой ты в конфликте',
  teaser: 'т',
  intro: 'Пара вопросов о твоей реакции',
  questions: [
    { text: 'Вопрос 1', options: [{ label: 'Молчу', resultId: 'calm' }, { label: 'Спорю', resultId: 'fight' }] },
    { text: 'Вопрос 2', options: [{ label: 'Ухожу', resultId: 'calm' }, { label: 'Настаиваю', resultId: 'fight' }] },
  ],
  results: [
    { id: 'calm', emoji: '🧊', title: 'Спокойный', text: 'т', hint: 'подсказка' },
    { id: 'fight', emoji: '🔥', title: 'Боец', text: 'т', hint: 'подсказка' },
  ],
};

function renderQuiz(quizId = 'anger') {
  return render(
    <MemoryRouter initialEntries={[`/tests/${quizId}`]}>
      <Routes>
        <Route path="/tests/:quizId" element={<QuizPage />} />
        <Route path="/tests" element={<div>Список тестов</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('QuizPage — загрузка и ошибки', () => {
  it('пока список тестов не пришёл — показывает скелетон, а не спиннер', () => {
    mockUseQuizzes.mockReturnValue({ quizzes: null, error: false });
    renderQuiz();
    expect(screen.getByLabelText('Тест загружается')).toBeTruthy();
  });

  it('незнакомый quizId после загрузки уводит на список тестов, а не на пустой экран', () => {
    mockUseQuizzes.mockReturnValue({ quizzes: [QUIZ], error: false });
    renderQuiz('unknown-quiz');
    expect(screen.getByText('Список тестов')).toBeTruthy();
  });
});

describe('QuizPage — прохождение', () => {
  beforeEach(() => {
    mockUseQuizzes.mockReturnValue({ quizzes: [QUIZ], error: false });
  });

  it('интро отвечает «что это и зачем» до первого вопроса (правило онбординга)', () => {
    renderQuiz();
    expect(screen.getByText('Какой ты в конфликте')).toBeTruthy();
    expect(screen.getByText('Пара вопросов о твоей реакции')).toBeTruthy();
    expect(screen.getByText('2 вопросов · ~2 минуты')).toBeTruthy();
  });

  it('старт шлёт quiz_started и показывает первый вопрос', () => {
    renderQuiz();
    fireEvent.click(screen.getByText('Начать →'));
    expect(trackMock).toHaveBeenCalledWith('quiz_started', { quiz: 'anger' });
    expect(screen.getByText('Вопрос 1')).toBeTruthy();
    expect(screen.getByText('Вопрос 1 из 2')).toBeTruthy();
  });

  it('ответ на все вопросы показывает результат и шлёт quiz_completed ровно один раз', () => {
    renderQuiz();
    fireEvent.click(screen.getByText('Начать →'));
    fireEvent.click(screen.getByText('Спорю'));
    fireEvent.click(screen.getByText('Настаиваю'));

    expect(screen.getByText('Боец')).toBeTruthy();
    const completedCalls = trackMock.mock.calls.filter((c) => c[0] === 'quiz_completed');
    expect(completedCalls).toHaveLength(1);
    expect(completedCalls[0][1]).toEqual({ quiz: 'anger', result: 'fight' });
  });

  it('результат явно маркирован как наблюдение, а не диагноз', () => {
    // Регрессия: без этой строки мини-тест выглядит как психодиагностика.
    renderQuiz();
    fireEvent.click(screen.getByText('Начать →'));
    fireEvent.click(screen.getByText('Молчу'));
    fireEvent.click(screen.getByText('Ухожу'));
    expect(screen.getByText(/Это игра-наблюдение, а не диагноз/)).toBeTruthy();
  });

  it('«Пройти ещё раз» сбрасывает прогресс и разрешает повторно отправить quiz_completed', () => {
    renderQuiz();
    fireEvent.click(screen.getByText('Начать →'));
    fireEvent.click(screen.getByText('Молчу'));
    fireEvent.click(screen.getByText('Ухожу'));
    fireEvent.click(screen.getByText('Пройти ещё раз'));
    expect(screen.getByText('Вопрос 1 из 2')).toBeTruthy();
  });

  it('без navigator.share копирует результат в буфер обмена и показывает подтверждение', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderQuiz();
    fireEvent.click(screen.getByText('Начать →'));
    fireEvent.click(screen.getByText('Спорю'));
    fireEvent.click(screen.getByText('Настаиваю'));
    fireEvent.click(screen.getByText('Поделиться результатом'));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByText('Скопировано ✓')).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
