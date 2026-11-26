// @vitest-environment jsdom
// Чип режима в «Где применяется» листа техники: goBack нижнего листа раздела снимает и технику над ним, затем — лист режима.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SheetBack } from '../ConceptFullscreenSheet';
import { ConceptGuideSheets } from './ConceptGuideSheets';

vi.mock('../../../api', () => ({ api: { trackEvent: vi.fn() }, reportClientError: vi.fn() }));

describe('ConceptGuideSheets — из техники в режим', () => {
  it('тап по режиму: goBack листа раздела, затем onOpenMode', async () => {
    const actions = { onOpenMode: vi.fn(), onOpenSchema: vi.fn(), onOpenTechnique: vi.fn() };
    const sectionBack = vi.fn((then?: unknown) => (then as () => void)());
    const backRefs = { section: { current: sectionBack as SheetBack }, technique: { current: null } };
    render(<MemoryRouter><ConceptGuideSheets
      open={{ sheet: null, technique: { id: 'chairwork' } }} actions={actions} backRefs={backRefs}
      onCloseSheet={() => {}} onCloseTechnique={() => {}}
    /></MemoryRouter>);
    const used = await screen.findByRole('region', { name: 'Где применяется' });
    const chip = within(within(used).getByRole('region', { name: 'Режимы' })).getAllByRole('button')[0];
    fireEvent.click(chip);
    expect(sectionBack).toHaveBeenCalledTimes(1);
    expect(actions.onOpenMode).toHaveBeenCalledWith(expect.any(String));
  });
});
