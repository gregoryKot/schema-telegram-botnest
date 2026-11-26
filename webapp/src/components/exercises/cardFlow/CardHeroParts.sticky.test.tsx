// @vitest-environment jsdom
// Липкий предок (test-support/stickyAncestors.ts): ссылка «Про режим» (CardHeroLinks) стоит в листе-герое —
// в липкой колонке разворота; портрет режима, который она открывает, ложится в колонку формы.
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeEx } from '../FlashcardEx';
import { openFromSticky, stickyClasses } from '../../../test-support/stickyAncestors';
import { allCssRules, indexCssRules } from '../../../styles/cssRules.test-helpers';

vi.mock('../../../api', () => ({
  api: { getModeNotes: vi.fn().mockResolvedValue([]), saveModeNote: vi.fn(), trackEvent: vi.fn() },
}));

it('ModeEx: портрет режима по «Про режим» — вне липкой колонки', () => {
  render(<MemoryRouter><ModeEx onBack={vi.fn()} initialModeId="vulnerable_child" /></MemoryRouter>);
  fireEvent.click(screen.getByText('Заполнить свою карточку →')); // портрет при первом входе → вопросы
  const about = screen.getByRole('button', { name: /Про режим/ });
  expect(openFromSticky(about, fireEvent.click, () => document.querySelector('.ex2-portrait'),
    stickyClasses([...indexCssRules(), ...allCssRules()]))).toEqual({ from: ['div.pa-spread-side'], sheet: [] });
});
