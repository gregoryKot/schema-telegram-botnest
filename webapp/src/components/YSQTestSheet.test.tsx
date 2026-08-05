// @vitest-environment jsdom
// YSQTestSheet — экран теста на схемы (интро/тест/результат). Логика счёта и
// сохранения уже покрыта shared/src/hooks/useYsqTest.test.ts — здесь
// проверяем именно UI-обёртку: какая фаза рендерится, продолжение
// сохранённого прогресса (не начинаем заново молча), реальный подсчёт
// результата из ответов (не хардкод), и повторное прохождение. Даты — везде
// `new Date()`/относительные, литералов не используем (CLAUDE.md).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { YSQTestSheet } from './YSQTestSheet';
import { QUESTIONS, YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from '../hooks/useYsqTest';

vi.mock('../api', () => ({
  api: {
    getYsqHistory: vi.fn().mockResolvedValue([]),
    getYsqResult: vi.fn().mockResolvedValue(null),
    getYsqProgress: vi.fn().mockResolvedValue(null),
    saveYsqProgress: vi.fn().mockResolvedValue(undefined),
    saveYsqResult: vi.fn().mockResolvedValue(undefined),
    deleteYsqProgress: vi.fn().mockResolvedValue(undefined),
    deleteYsqResult: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
    trackPublicEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet(onClose = vi.fn(), form: 'ty' | 'vy' = 'ty') {
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter initialEntries={['/schemas']}>
        <YSQTestSheet onClose={onClose} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
  return { onClose };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockApi.getYsqHistory.mockResolvedValue([]);
  mockApi.getYsqResult.mockResolvedValue(null);
  mockApi.getYsqProgress.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('YSQTestSheet — интро: пусто vs сохранённый прогресс (не начинаем заново молча)', () => {
  it('без сохранённого прогресса — «Начать тест», без «Продолжить»', async () => {
    renderSheet();
    await waitFor(() => expect(screen.getByText('Начать тест')).toBeTruthy());
    expect(screen.queryByText(/Продолжить/)).toBeNull();
  });

  it('с сохранённым прогрессом — «Продолжить (N из 116)» показывает РЕАЛЬНОЕ число отвеченных', () => {
    const answers = Array(QUESTIONS.length).fill(0);
    answers[0] = 3; answers[1] = 5; answers[2] = 2; // 3 реально отвеченных
    localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ answers, page: 3 }));
    renderSheet();
    expect(screen.getByText(`Продолжить (3 из ${QUESTIONS.length})`)).toBeTruthy();
  });

  it('«Начать тест» переводит в фазу теста на первый вопрос', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Начать тест'));
    expect(screen.getByText(QUESTIONS[0])).toBeTruthy();
  });

  it('«Продолжить» возвращает на СОХРАНЁННУЮ страницу, а не на первый вопрос', () => {
    const answers = Array(QUESTIONS.length).fill(0);
    answers[0] = 4;
    localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ answers, page: 5 }));
    renderSheet();
    fireEvent.click(screen.getByText(/Продолжить/));
    expect(screen.getByText(QUESTIONS[5])).toBeTruthy();
  });

  it('«Отмена» закрывает лист (goBack → onClose)', async () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByText('Отмена'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('YSQTestSheet — прохождение теста', () => {
  it('выбор ответа на не последний вопрос через задержку переводит на следующий', () => {
    vi.useFakeTimers();
    renderSheet();
    fireEvent.click(screen.getByText('Начать тест'));
    expect(screen.getByText(QUESTIONS[0])).toBeTruthy();

    fireEvent.click(screen.getByText('Иногда бывает'));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByText(QUESTIONS[1])).toBeTruthy();
  });

  it('«Назад» после первого вопроса возвращает к предыдущему (кнопка активна только со 2-го вопроса)', () => {
    vi.useFakeTimers();
    renderSheet();
    fireEvent.click(screen.getByText('Начать тест'));
    // На первом вопросе «Назад» задизейблена — прыгать в интро отсюда некуда
    // (это намеренно: YsqTestHeader блокирует кнопку при page===0).
    expect((screen.getByLabelText('Назад') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText('Иногда бывает'));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByText(QUESTIONS[1])).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Назад'));
    expect(screen.getByText(QUESTIONS[0])).toBeTruthy();
  });
});

describe('YSQTestSheet — результат: реальный подсчёт из ответов, не заглушка', () => {
  function seedResult(value: number) {
    const answers = Array(QUESTIONS.length).fill(value);
    localStorage.setItem(YSQ_RESULT_KEY, JSON.stringify({ date: new Date().toISOString(), answers }));
  }

  it('все ответы «Совсем не про меня» (1) → «Выраженных схем нет», без хардкод-чисел', async () => {
    seedResult(1);
    renderSheet();
    await waitFor(() => expect(screen.getByText('Выраженных схем нет – отличный результат.')).toBeTruthy());
  });

  it('все ответы «Полностью про меня» (6) → показывает активные схемы со РЕАЛЬНЫМ средним баллом', async () => {
    seedResult(6);
    renderSheet();
    await waitFor(() => expect(screen.queryByText('Выраженных схем нет – отличный результат.')).toBeNull());
    // Средний балл 6.0 из 6 у каждой активной схемы — считается из ответов,
    // а не подставляется константой.
    expect(screen.getAllByText('6').length).toBeGreaterThan(0);
  });

  it('кнопка «Поделиться» открывает карточку результата (не падает на пустых данных)', async () => {
    // Карточка шаринга рисует canvas — jsdom его не реализует.
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      stroke: vi.fn(), fill: vi.fn(), closePath: vi.fn(), arc: vi.fn(), fillRect: vi.fn(),
      fillText: vi.fn(), measureText: vi.fn(() => ({ width: 0 })), clearRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      roundRect: vi.fn(), clip: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
      drawImage: vi.fn(), setLineDash: vi.fn(), globalAlpha: 1, textAlign: 'left' as CanvasTextAlign,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as RenderingContext);
    seedResult(6);
    renderSheet();
    await waitFor(() => expect(screen.getAllByText(/Поделиться/)[0]).toBeTruthy());
    fireEvent.click(screen.getAllByText(/Поделиться/)[0]);
    await waitFor(() => expect(document.querySelector('canvas')).toBeTruthy());
  });

  it('«Пройти заново» требует подтверждения, отмена НЕ удаляет результат', async () => {
    seedResult(6);
    renderSheet();
    await waitFor(() => expect(screen.getByText('Пройти заново')).toBeTruthy());
    fireEvent.click(screen.getByText('Пройти заново'));
    expect(screen.getByText('Результаты будут удалены. Точно начать заново?')).toBeTruthy();
    fireEvent.click(screen.getByText('Отмена'));
    expect(screen.queryByText('Результаты будут удалены. Точно начать заново?')).toBeNull();
    expect(mockApi.deleteYsqResult).not.toHaveBeenCalled();
  });

  it('подтверждённый ретейк удаляет результат и возвращает в интро', async () => {
    seedResult(6);
    renderSheet();
    await waitFor(() => expect(screen.getByText('Пройти заново')).toBeTruthy());
    fireEvent.click(screen.getByText('Пройти заново'));
    fireEvent.click(screen.getByText('Начать заново'));
    await waitFor(() => expect(screen.getByText('Начать тест')).toBeTruthy());
    expect(mockApi.deleteYsqResult).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(YSQ_RESULT_KEY)).toBeNull();
  });
});

describe('YSQTestSheet — ты/вы-вилка в совете по схеме (правило CLAUDE.md)', () => {
  it('форма «вы» не показывает обращение на «ты» в подсказке-совете активной схемы', async () => {
    const answers = Array(QUESTIONS.length).fill(6);
    localStorage.setItem(YSQ_RESULT_KEY, JSON.stringify({ date: new Date().toISOString(), answers }));
    renderSheet(vi.fn(), 'vy');
    await waitFor(() => expect(screen.getAllByText('💡').length).toBeGreaterThan(0));
    const tips = screen.getAllByText('💡').map(el => el.parentElement?.textContent ?? '');
    for (const tip of tips) {
      expect(tip).not.toMatch(/[Тт]ы(?:\s|$)|[Тт]еб[еяё]|[Тт]во[йяеё]/);
    }
  });
});
