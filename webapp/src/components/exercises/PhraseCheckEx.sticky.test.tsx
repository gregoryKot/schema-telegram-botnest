// @vitest-environment jsdom
// Липкий предок (test-support/stickyAncestors.ts): «Прошлые разборы» стоят в колонке подсказки (.ex2-aside,
// sticky); карточка разбора, которую открывает строка, — сиблинг экрана, не в этой колонке.
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PhraseCheckEx } from './PhraseCheckEx';
import { openFromSticky, stickyClasses } from '../../test-support/stickyAncestors';
import { allCssRules, indexCssRules } from '../../styles/cssRules.test-helpers';

const PAST = { id: 1, phrase: 'опять не успела', marks: ['worth'], rewrite: null, inWarmWords: false, createdAt: '2026-11-01T10:00:00.000Z' };
vi.mock('../../api', () => ({
  api: { getPhraseChecks: vi.fn(async () => [PAST]), trackEvent: vi.fn() },
}));

it('PhraseCheckEx: карточка прошлого разбора — вне липкой колонки подсказки', async () => {
  render(<MemoryRouter><PhraseCheckEx onBack={vi.fn()} /></MemoryRouter>);
  const row = await screen.findByLabelText(`Открыть разбор: ${PAST.phrase}`);
  expect(openFromSticky(row, fireEvent.click, () => screen.getByText('Разбор фразы').closest('.sheet-modal'),
    stickyClasses([...indexCssRules(), ...allCssRules()]))).toEqual({ from: ['aside.ex2-aside'], sheet: [] });
});
