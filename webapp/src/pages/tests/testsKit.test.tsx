// @vitest-environment jsdom
// testsKit — общий каркас публичных страниц мини-тестов: TestsFrame
// (навбар/футер/CTA в приложение) и QuizProgress (прогресс-бар прохождения).
// Файл был на 0% покрытия — рендер-тест ловит, если каркас перестанет
// монтироваться или прогресс-бар посчитает долю неверно (index/total).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestsFrame, QuizProgress } from './testsKit';
import { AuthContext, type AuthState } from '../../auth/authContext';

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

  // U7 (аудит 2026-11): шапка и футер звали в бота, хотя трекер и дневники
  // есть на сайте, а лендинг говорит «Telegram не нужен».
  it('главная дверь — в приложение, бот — вторым путём; шапка не зовёт в бота', () => {
    const { container } = renderFrame(<div />);
    const main = screen.getByText('Начать в приложении →');
    expect(main.getAttribute('href')).toBe('/login');
    expect(main.className).not.toContain('ds-btn--secondary');
    expect(screen.getByText('Бот в Telegram ↗').className).toContain('ds-btn--secondary');
    expect(screen.queryByText('Продолжить в Telegram')).toBeNull();
    const header = container.querySelector('header')!;
    expect(header.textContent).not.toMatch(/Telegram|бот/i);
    expect(header.querySelector('a[href="/login"]')?.textContent).toBe('Войти');
    expect(screen.getByText(/в приложении на сайте, в Telegram и MAX/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/есть в телеграм-боте/);
  });

  it('вошедший — сразу в приложение, а не на вход', () => {
    render(
      <AuthContext.Provider value={{ isAuthenticated: true } as AuthState}>
        <MemoryRouter><TestsFrame><div /></TestsFrame></MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByText('Перейти в приложение →').getAttribute('href')).toBe('/today');
    expect(screen.getByText('В приложение').getAttribute('href')).toBe('/today');
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
