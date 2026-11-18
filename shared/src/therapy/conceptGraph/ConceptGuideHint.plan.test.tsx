// @vitest-environment jsdom
// Плашка «Обычно в методе»: «В план» в строке подписи рубрик «На сессии» и
// «Между сессиями» отдаёт сайту техники или пункты раздела и чей он; без
// колбэков (плашка вне кабинета терапевта) кнопок нет.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConceptGuideHint } from './ConceptGuideHint';
import type { ConceptGuideActions } from './conceptGuide';
import { FIXTURE_VIEW } from './conceptGuide.fixture';

const MODE = { kind: 'mode', id: 'vulnerable_child' } as const;
const base: ConceptGuideActions = {
  onOpenMode: vi.fn(),
  onOpenSchema: vi.fn(),
  onOpenTechnique: vi.fn(),
};

describe('ConceptGuideHint — «В план»', () => {
  it('кнопки рубрик зовут колбэк с техниками или пунктами и разделом', () => {
    const onPlanSession = vi.fn();
    const onPlanBetween = vi.fn();
    render(
      <ConceptGuideHint
        view={FIXTURE_VIEW}
        from={MODE}
        actions={{ ...base, onPlanSession, onPlanBetween }}
      />,
    );
    const session = screen.getByRole('button', { name: 'В план: На сессии' });
    expect(session.style.minHeight).toBe('44px');
    fireEvent.click(session);
    expect(onPlanSession).toHaveBeenCalledWith(FIXTURE_VIEW.techniques, MODE);
    fireEvent.click(
      screen.getByRole('button', { name: 'В план: Между сессиями' }),
    );
    expect(onPlanBetween).toHaveBeenCalledWith(
      FIXTURE_VIEW.guide.betweenSessions,
      MODE,
    );
  });

  it('без колбэков кнопок «В план» нет, подписи рубрик на месте', () => {
    render(<ConceptGuideHint view={FIXTURE_VIEW} from={MODE} actions={base} />);
    expect(screen.queryByRole('button', { name: /^В план/ })).toBeNull();
    expect(screen.getByText('На сессии')).toBeTruthy();
    expect(screen.getByText('Между сессиями')).toBeTruthy();
  });
});
