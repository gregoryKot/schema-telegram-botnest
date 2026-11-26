// @vitest-environment jsdom
// Липкий предок (test-support/stickyAncestors.ts): у листа-героя наклейка «самопомощь» стоит под кнопками,
// не в липкой колонке разворота, — её лист «Поговорить с кем-то» не попадает под липкого предка.
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SafePlaceEx } from './SafePlaceEx';
import { openFromSticky, stickyClasses } from '../../test-support/stickyAncestors';
import { allCssRules, indexCssRules } from '../../styles/cssRules.test-helpers';

vi.mock('../../api', () => ({ api: { saveSafePlace: vi.fn(), trackEvent: vi.fn() } }));

it('SafePlaceEx: лист «Поговорить» из наклейки «самопомощь» — без липких предков', () => {
  render(<MemoryRouter><SafePlaceEx onBack={vi.fn()} /></MemoryRouter>);
  const link = screen.getByRole('button', { name: 'Поговорить →' });
  expect(openFromSticky(link, fireEvent.click, () => document.querySelector('.cw-sheet'),
    stickyClasses([...indexCssRules(), ...allCssRules()]))).toEqual({ from: [], sheet: [] });
});
