// @vitest-environment jsdom
// ErrorBoundary — секционный error boundary (0% покрытия). Аудит 2026-07:
// падение одной секции не должно убивать весь мини-апп. Проверяем: happy
// path (children рендерятся без ошибки), краш ловится и показывает фолбэк,
// «Попробовать снова» сбрасывает состояние, chunk-load ошибки НЕ уходят в
// reportClientError (не баг, а обычный деплой — иначе шумим админу зря).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
import { reportClientError } from '../api';

vi.mock('../api', () => ({ reportClientError: vi.fn() }));

function Boom({ message = 'кабум' }: { message?: string }): never {
  throw new Error(message);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  // React логирует падение в console.error дважды (dev-режим) — глушим шум,
  // сам факт вызова boundary проверяем через видимый фолбэк.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

describe('ErrorBoundary — без падения', () => {
  it('рендерит children как есть, если ошибки не было', () => {
    render(
      <ErrorBoundary section="Дневник">
        <div>Всё хорошо</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Всё хорошо')).toBeTruthy();
  });
});

describe('ErrorBoundary — падение секции', () => {
  it('ловит ошибку, показывает фолбэк с именем секции и текстом ошибки', () => {
    render(
      <ErrorBoundary section="Дневник">
        <Boom message="что-то сломалось" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Раздел «Дневник» не открылся')).toBeTruthy();
    expect(screen.getByText('что-то сломалось')).toBeTruthy();
  });

  it('обычная ошибка (не chunk-load) уходит в reportClientError с section', () => {
    render(
      <ErrorBoundary section="Профиль">
        <Boom message="TypeError: x is not a function" />
      </ErrorBoundary>,
    );
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'TypeError: x is not a function',
        section: 'Профиль',
      }),
    );
  });

  it('chunk-load ошибка (обычный деплой) НЕ уходит в reportClientError', () => {
    render(
      <ErrorBoundary section="Практики">
        <Boom message="Failed to fetch dynamically imported module: /x.js" />
      </ErrorBoundary>,
    );
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('«Попробовать снова» сбрасывает состояние и пробует отрендерить children заново', () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error('временный сбой');
      return <div>Восстановилось</div>;
    }
    const { rerender } = render(
      <ErrorBoundary section="Практики">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Раздел «Практики» не открылся')).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByText('Попробовать снова'));
    rerender(
      <ErrorBoundary section="Практики">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Восстановилось')).toBeTruthy();
  });
});
