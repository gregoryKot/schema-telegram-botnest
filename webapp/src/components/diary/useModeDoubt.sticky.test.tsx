// @vitest-environment jsdom
// Липкий предок (test-support/stickyAncestors.ts): ссылку «Сравни с похожими» экран ставит в лист-герой —
// в липкую колонку разворота, а лист сравнения хук отдаёт отдельно, и он ложится вне колонки.
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useModeDoubt } from './useModeDoubt';
import { modeLookById } from './modeLookById';
import { ExScreen } from '../exercises/ExScreen';
import { openFromSticky, stickyClasses } from '../../test-support/stickyAncestors';
import { allCssRules, indexCssRules } from '../../styles/cssRules.test-helpers';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));

// Раскладка — как у формы режима (ModeEntryForm): ссылка в heroFoot разворота, лист — сиблингом экрана.
function Host() {
  const { link, sheet } = useModeDoubt('vulnerable_child', vi.fn());
  return (
    <>
      <ExScreen onBack={vi.fn()} look={modeLookById('vulnerable_child')} spread eyebrow="Режим" title="Уязвимый Ребёнок" heroFoot={link} />
      {sheet}
    </>
  );
}

it('useModeDoubt: лист сравнения из листа-героя — вне липкой колонки', () => {
  render(<MemoryRouter><Host /></MemoryRouter>);
  const link = screen.getByRole('button', { name: 'Сомневаешься? Сравни с похожими' });
  expect(openFromSticky(link, fireEvent.click, () => screen.getByText('сейчас выбран').closest('.ex-screen'),
    stickyClasses([...indexCssRules(), ...allCssRules()]))).toEqual({ from: ['div.pa-spread-side'], sheet: [] });
});
