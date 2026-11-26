// @vitest-environment jsdom
// Техники «На сессии» в плашке «Обычно в методе»: слова-кнопки с зоной нажатия
// 44 стояли с отрицательными полями (wordBtn) и при шаге строк ~22px
// перекрывали друг друга — тап попадал в соседнюю технику (стенд редизайна
// 2026-11, b32). Кнопка в своей строке — без отрицательных полей: соседние
// боксы в потоке не пересекаются.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConceptGuideHint } from './ConceptGuideHint';
import type { ConceptGuideActions } from './conceptGuide';
import { FIXTURE_VIEW } from './conceptGuide.fixture';

const actions: ConceptGuideActions = {
  onOpenMode: vi.fn(),
  onOpenSchema: vi.fn(),
  onOpenTechnique: vi.fn(),
  onAssign: vi.fn(),
};

describe('ConceptGuideHint — зоны нажатия техник', () => {
  it('каждая техника — кнопка 44 по высоте без отрицательных полей', () => {
    render(
      <ConceptGuideHint
        view={FIXTURE_VIEW}
        from={{ kind: 'mode', id: 'vulnerable_child' }}
        actions={actions}
      />,
    );
    expect(FIXTURE_VIEW.techniques.length).toBeGreaterThan(1);
    for (const t of FIXTURE_VIEW.techniques) {
      const btn = screen.getByRole('button', { name: t.name });
      expect(btn.style.minHeight).toBe('44px');
      expect(btn.style.margin).toBe('0px');
      // строка техники держит кнопку целиком: ряд переносится, а не сжимается
      expect(btn.parentElement?.style.display).toBe('inline-flex');
    }
  });

  it('«Дать заданием» — тоже без отрицательных полей', () => {
    render(
      <ConceptGuideHint
        view={FIXTURE_VIEW}
        from={{ kind: 'mode', id: 'vulnerable_child' }}
        actions={actions}
      />,
    );
    for (const btn of screen.getAllByRole('button', { name: /^Дать заданием/ }))
      expect(btn.style.margin).toBe('0px');
  });
});
