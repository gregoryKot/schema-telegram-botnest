// @vitest-environment jsdom
// Регрессия на фидбек владельца 2026-08 («что за рамку??»): внутренний
// термин «рамка» не выносится в интерфейс шага сцены — тумблер и подсказка
// говорят «пример» (shared/src/case/caseFrames.ts, buildFramesToggle/
// buildFrameHint). Twin webapp CaseSceneScreen.test.tsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CaseSceneScreen } from './CaseSceneScreen';
import { CASE_FRAMES } from '../../../../shared/src/case/caseFrames';
import type { Tr } from '../../../../shared/src/case/caseTypes';

afterEach(() => cleanup());

const tyTr: Tr = (ty) => ty;

function renderScreen(
  overrides: Partial<Parameters<typeof CaseSceneScreen>[0]> = {},
) {
  return render(
    <CaseSceneScreen
      value=""
      chosenFrame=""
      onChange={vi.fn()}
      onPickFrame={vi.fn()}
      onNext={vi.fn()}
      tr={tyTr}
      {...overrides}
    />,
  );
}

describe('CaseSceneScreen — тумблер примеров без слова «рамка»', () => {
  it('закрыт: «Не идёт — начать с примера →», открыт: «Скрыть примеры ▲» + список', () => {
    renderScreen();
    fireEvent.click(screen.getByText('Не идёт — начать с примера →'));
    expect(screen.getByText('Скрыть примеры ▲')).toBeTruthy();
    for (const frame of CASE_FRAMES) {
      expect(screen.getByText(frame)).toBeTruthy();
    }
  });

  it('тап по примеру отдаёт его в onPickFrame и сворачивает список', () => {
    const onPickFrame = vi.fn();
    renderScreen({ onPickFrame });
    fireEvent.click(screen.getByText('Не идёт — начать с примера →'));
    fireEvent.click(screen.getByText(CASE_FRAMES[0]));
    expect(onPickFrame).toHaveBeenCalledWith(CASE_FRAMES[0]);
    expect(screen.queryByText('Скрыть примеры ▲')).toBeNull();
  });

  it('после выбора подсказка говорит «Это пример…», и жаргона нет нигде на экране', () => {
    const { container } = renderScreen({
      chosenFrame: CASE_FRAMES[0],
      value: CASE_FRAMES[0],
    });
    expect(screen.getByText(/Это пример\. Допиши/)).toBeTruthy();
    expect(/[Рр]амк/.test(container.textContent ?? '')).toBe(false);
  });
});
