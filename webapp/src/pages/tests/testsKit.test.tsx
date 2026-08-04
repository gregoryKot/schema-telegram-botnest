// @vitest-environment jsdom
// testsKit — общий каркас публичных страниц мини-тестов: TestsFrame
// (навбар/футер/CTA в бота) и QuizProgress (прогресс-бар прохождения).
// Файл был на 0% покрытия — рендер-тест ловит, если каркас перестанет
// монтироваться или прогресс-бар посчитает долю неверно (index/total).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestsFrame, QuizProgress } from './testsKit';

afterEach(() => {
  cleanup();
});

function renderFrame(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <TestsFrame>{children}</TestsFrame>
    </MemoryRouter>,
  );
}

describe('TestsFrame', () => {
  it('рендерит переданный контент внутри общего каркаса', () => {
    renderFrame(<p>Содержимое теста</p>);
    expect(screen.getByText('Содержимое теста')).toBeTruthy();
  });

  it('футер содержит ссылку в бота и в приложение', () => {
    renderFrame(<div />);
    expect(screen.getByText('Продолжить в Telegram')).toBeTruthy();
    expect(screen.getByText('Войти в приложение')).toBeTruthy();
  });

  it('явно помечает результат как наблюдение, а не диагностику', () => {
    // Регрессия на клинический disclaimer — без него мини-тест читается
    // как медицинский инструмент, что запрещено правилами продукта.
    renderFrame(<div />);
    expect(screen.getByText(/не диагностика и не замена психотерапии/)).toBeTruthy();
  });
});

describe('QuizProgress', () => {
  it('показывает текущий вопрос (1-based) из общего числа', () => {
    renderFrame(<QuizProgress index={2} total={7} />);
    expect(screen.getByText('Вопрос 3 из 7')).toBeTruthy();
  });

  it('первый вопрос показывает "Вопрос 1 из N"', () => {
    renderFrame(<QuizProgress index={0} total={5} />);
    expect(screen.getByText('Вопрос 1 из 5')).toBeTruthy();
  });

  it('даёт ссылку на выход из теста без потери прогресса на сервере', () => {
    renderFrame(<QuizProgress index={0} total={5} />);
    expect(screen.getByText('✕ выйти')).toBeTruthy();
  });
});
