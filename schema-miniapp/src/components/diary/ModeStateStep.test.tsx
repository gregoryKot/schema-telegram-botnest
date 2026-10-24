// @vitest-environment jsdom
// Фидбек владельца 2026-08-31: в разборе случая на шаге чувств всплывал
// абзац «Дневник — про вчерашний вечер…», написанный для дневника режимов, —
// сбивал (разбор про текущий момент) и произносил слово «режим» до экрана,
// который его вводит. Шаг общий, поэтому режим показа абзаца — проп.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ModeStateStep } from './ModeStateStep';

vi.mock('../../haptic', () => ({ haptic: { tap: vi.fn() } }));

afterEach(cleanup);

const noop = () => {};

describe('ModeStateStep — абзац про дневник', () => {
  it('в дневнике (по умолчанию) абзац виден', () => {
    render(<ModeStateStep onPickGroup={noop} onPickMode={noop} />);
    expect(screen.getByText(/Дневник — про вчерашний вечер/)).toBeTruthy();
  });

  it('в разборе случая (showDiaryExplainer=false) абзаца нет — и слова «режим» на экране нет', () => {
    render(
      <ModeStateStep
        onPickGroup={noop}
        onPickMode={noop}
        showDiaryExplainer={false}
      />,
    );
    expect(screen.queryByText(/вчерашний вечер/)).toBeNull();
    // «Все режимы по группам» — третичный путь для тех, кто термины уже
    // знает, он остаётся; исчезнуть обязан именно обучающий абзац дневника.
    expect(document.body.textContent).not.toMatch(/запускает режим/);
  });
});
