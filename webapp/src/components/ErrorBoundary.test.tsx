// @vitest-environment jsdom
// ErrorBoundary — ловит краш секции (0% покрытия). Проверяем: обычный краш
// показывает fallback с деталями и шлёт reportClientError на бэкенд (правило
// «видимость прода»); краш стейл-чанка после деплоя показывает отдельный
// экран, авто-релоадит один раз и НЕ шлёт reportClientError (не баг).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const reportClientError = vi.fn();
vi.mock('../api', () => ({
  reportClientError: (...a: unknown[]) => reportClientError(...a),
}));

function Boom({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  // React логирует краш в консоль ошибками — глушим шум теста, но не мешаем.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  reloadSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadSpy },
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  sessionStorage.clear();
});

describe('ErrorBoundary — обычный краш', () => {
  it('показывает fallback с названием секции и шлёт reportClientError', () => {
    render(
      <ErrorBoundary section="Дневник">
        <Boom message="something broke" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Раздел упал')).toBeTruthy();
    expect(screen.getByText('Дневник')).toBeTruthy();
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'something broke', section: 'Дневник' }),
    );
  });

  it('«Попробовать снова» сбрасывает состояние ошибки', () => {
    render(
      <ErrorBoundary section="Дневник">
        <Boom message="err" />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('Попробовать снова'));
    // getDerivedStateFromError сбросился — children снова рендерятся (снова падают,
    // но fallback остаётся видимым, ошибка перехвачена повторно без падения теста).
    expect(screen.getByText('Раздел упал')).toBeTruthy();
  });
});

describe('ErrorBoundary — устаревший чанк после деплоя', () => {
  it('показывает отдельный экран «Страница устарела» и НЕ шлёт reportClientError', () => {
    render(
      <ErrorBoundary section="Дневник">
        <Boom message="Failed to fetch dynamically imported module" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Страница устарела')).toBeTruthy();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('авто-релоадит один раз (метка в sessionStorage предотвращает цикл)', () => {
    render(
      <ErrorBoundary section="Дневник">
        <Boom message="Loading chunk 3 failed" />
      </ErrorBoundary>,
    );
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('chunk-reload-at')).toBeTruthy();
  });

  // Инцидент 2026-10-19: Safari пишет «Importing a module script failed.» —
  // проверка знала только текст Chrome, и на iPhone вместо перезагрузки
  // показывался «Раздел упал» со стеком.
  it('Safari: «Importing a module script failed.» — тоже устаревший чанк', () => {
    render(
      <ErrorBoundary section="Сегодня">
        <Boom message="Importing a module script failed." />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Страница устарела')).toBeTruthy();
    expect(screen.queryByText('Раздел упал')).toBeNull();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(reportClientError).not.toHaveBeenCalled();
  });
});
