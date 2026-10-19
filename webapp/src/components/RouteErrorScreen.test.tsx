// @vitest-environment jsdom
// Ошибка уровня маршрута: вместо служебной страницы React Router — свой экран.
// Инцидент 2026-10-19: на iPhone после деплоя «Unexpected Application Error!
// Importing a module script failed.» с подсказкой для разработчика.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RouteErrorScreen } from './RouteErrorScreen';

const reportClientError = vi.fn();
vi.mock('../api', () => ({
  reportClientError: (...a: unknown[]) => reportClientError(...a),
}));

function Boom({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

function renderRoute(message: string) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: <Boom message={message} />,
      errorElement: <RouteErrorScreen />,
    },
  ]);
  return render(<RouterProvider router={router} />);
}

const reload = vi.fn();
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload },
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

describe('RouteErrorScreen', () => {
  it('Safari: устаревший чанк — перезагрузка, экран «Страница устарела», без отчёта', () => {
    renderRoute('Importing a module script failed.');
    expect(screen.getByText('Страница устарела')).toBeTruthy();
    expect(screen.queryByText(/Hey developer/)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('обычная ошибка — понятный экран и отчёт наверх', () => {
    renderRoute('boom');
    expect(screen.getByText('Что-то пошло не так')).toBeTruthy();
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom', section: 'route' }),
    );
    expect(reload).not.toHaveBeenCalled();
  });
});
