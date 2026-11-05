// @vitest-environment jsdom
// Пин стража crashScreenGuard.ts: оба исхода (экран есть → бросает; нет → тихо),
// allowCrashScreen() действует на один тест, оба настоящих экрана несут маркер.
// Сам afterEach-хук проверен контролем: убрать allowCrashScreen() из теста
// ErrorBoundary — тест краснеет сообщением стража.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { RouteErrorScreen } from '../components/RouteErrorScreen';
import {
  CRASH_SCREEN_ATTR,
  allowCrashScreen,
  assertNoCrashScreen,
  findCrashScreens,
  isCrashScreenAllowed,
} from './crashScreenGuard';

vi.mock('../api', () => ({ reportClientError: vi.fn() }));

function Boom(): React.ReactElement {
  throw new Error('kaboom');
}

function renderBoundary() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return render(
    <ErrorBoundary section="Статьи">
      <Boom />
    </ErrorBoundary>,
  );
}

describe('crashScreenGuard — оба исхода', () => {
  it('экран ErrorBoundary нарисован → проверка бросает, в сообщении ошибка и подсказка', () => {
    allowCrashScreen(); // этот тест рисует экран намеренно
    const { container } = renderBoundary();
    const seen = findCrashScreens(container);
    expect(seen).toHaveLength(1);
    expect(() => assertNoCrashScreen(seen, false)).toThrow(/Раздел упал.*kaboom.*allowCrashScreen\(\)/s);
  });

  it('экрана нет → тихо', () => {
    const { container } = render(<h1>Статьи</h1>);
    const seen = findCrashScreens(container);
    expect(seen).toEqual([]);
    expect(() => assertNoCrashScreen(seen, false)).not.toThrow();
  });

  it('разрешённый экран не бросает', () => {
    expect(() => assertNoCrashScreen(['boundary «x»'], true)).not.toThrow();
  });
});

describe('crashScreenGuard — allowCrashScreen действует на один тест', () => {
  it('включает разрешение', () => {
    expect(isCrashScreenAllowed()).toBe(false);
    allowCrashScreen();
    expect(isCrashScreenAllowed()).toBe(true);
  });

  it('в следующем тесте разрешение сброшено', () => {
    expect(isCrashScreenAllowed()).toBe(false);
  });
});

describe('crashScreenGuard — маркер на обоих экранах', () => {
  it('ErrorBoundary несёт data-crash-screen', () => {
    allowCrashScreen();
    const { container } = renderBoundary();
    expect(container.querySelector(`[${CRASH_SCREEN_ATTR}="boundary"]`)).not.toBeNull();
  });

  it('RouteErrorScreen несёт data-crash-screen', () => {
    allowCrashScreen();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const router = createMemoryRouter(
      [{ path: '/', element: <RouteErrorScreen /> }],
      { initialEntries: ['/'] },
    );
    const { container } = render(<RouterProvider router={router} />);
    expect(container.querySelector(`[${CRASH_SCREEN_ATTR}="route"]`)).not.toBeNull();
  });
});
