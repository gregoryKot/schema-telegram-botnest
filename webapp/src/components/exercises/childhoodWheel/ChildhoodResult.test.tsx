// @vitest-environment jsdom
// Среднее колеса детства показывается через fmtIndex — запятая, как у остальных средних.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../../utils/addressForm';
import { NEED_ORDER } from '../../../../../shared/src/needs/types';
import { ChildhoodResult } from './ChildhoodResult';

afterEach(() => cleanup());

describe('ChildhoodResult', () => {
  it('среднее 5.5 → «Среднее 5,5/10»', () => {
    const ratings = Object.fromEntries(NEED_ORDER.map((id, i) => [id, i % 2 ? 6 : 5]));
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
          <ChildhoodResult title="Колесо" ratings={ratings} onBack={vi.fn()} onEdit={vi.fn()} onOpenSchema={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/Среднее 5,\d\/10/).length).toBeGreaterThan(0);
  });
});
