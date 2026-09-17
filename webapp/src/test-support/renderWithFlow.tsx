// Общий тестовый хелпер для компонентов на @xyflow/react (CLAUDE.md: «одна
// механика — один компонент» действует и для тестовой инфраструктуры — не
// копируем ReactFlowProvider/полифиллы в каждый *.test.tsx карты режимов).
//
// jsdom не реализует ResizeObserver и window.matchMedia, которые @xyflow/react
// и ModeMapCanvas дергают при монтировании — без полифиллов рендер падает
// ДО того, как тест успеет что-то проверить (см. ModeMapCanvas.tsx: isDesktop
// использует matchMedia напрямую в теле компонента, не в эффекте).
import { vi } from 'vitest';
import { render, fireEvent, screen, type RenderResult } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';

/** Ставит ResizeObserver/matchMedia полифиллы — вызывать в beforeEach. */
export function installFlowTestPolyfills() {
  class ResizeObserverStub {
    observe() { /* xyflow не использует размеры в jsdom-тестах */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
  }
  // @ts-expect-error — тестовый полифилл, не полная реализация DOM API
  global.ResizeObserver = ResizeObserverStub;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** Рендерит компонент внутри ReactFlowProvider — нужен для useViewport()/useReactFlow(). */
export function renderWithFlow(ui: ReactElement): RenderResult {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>);
}

// Кнопки тулбара карты режимов (TbBtn) не имеют title/aria-label на самой
// <button> — подсказка рендерится отдельным элементом только по hover
// (см. modeMap/ToolbarControls.tsx). Обычный getByTitle/getByRole тут не
// работает — наводим курсор на каждую кнопку, пока не найдём ту, что
// показывает нужный текст подсказки, и кликаем по ней.
export function clickToolbarButton(container: HTMLElement, label: string): void {
  const buttons = Array.from(container.querySelectorAll('button'));
  for (const btn of buttons) {
    fireEvent.mouseEnter(btn);
    const found = screen.queryByText(label);
    fireEvent.mouseLeave(btn);
    if (found) { fireEvent.click(btn); return; }
  }
  throw new Error(`toolbar-кнопка не найдена по подсказке: "${label}"`);
}
