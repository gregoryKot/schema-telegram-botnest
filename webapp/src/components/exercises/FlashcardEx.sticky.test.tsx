// @vitest-environment jsdom
// Липкий предок (test-support/stickyAncestors.ts): «Сменить схему» стоит в листе-герое — в липкой колонке
// разворота; выбор схемы, который она открывает, в эту колонку не попадает.
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaEx } from './FlashcardEx';
import { openFromSticky, stickyClasses } from '../../test-support/stickyAncestors';
import { allCssRules, indexCssRules } from '../../styles/cssRules.test-helpers';

vi.mock('../../api', () => ({
  api: { getSchemaNotes: vi.fn().mockResolvedValue([]), saveSchemaNote: vi.fn(), trackEvent: vi.fn() },
}));

it('SchemaEx: выбор схемы по «Сменить схему» — вне липкой колонки', () => {
  render(<MemoryRouter><SchemaEx onBack={vi.fn()} initialSchemaId="emotional_deprivation" /></MemoryRouter>);
  const link = screen.getByRole('button', { name: /Сменить схему/ });
  expect(openFromSticky(link, fireEvent.click, () => document.querySelector('.sd-groups-box'),
    stickyClasses([...indexCssRules(), ...allCssRules()]))).toEqual({ from: ['div.pa-spread-side'], sheet: [] });
});
