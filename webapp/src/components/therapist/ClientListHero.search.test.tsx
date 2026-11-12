// @vitest-environment jsdom
// Лупа в шапке «Клиентов» (b29, решение 9): на телефоне нет строки .topbar с «Перейти к… ⌘K», и палитра
// открывалась только с клавиатуры. Лупа открывает ту же палитру; в «Показе экрана» палитра та же —
// клиентов в ней нет (CommandPalette.screenShare.test.tsx), лупа своего списка имён не рисует.
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TherapyClientSummary } from '../../api';
import { ClientListHero } from './ClientListHero';
import { CommandPalette } from '../CommandPalette';
import { setScreenShare } from '../appShell/screenShareMode';

const CLIENT = {
  telegramId: 42, name: 'Иван', clientAlias: null, streak: 3, lastActiveDate: null, todayIndex: null,
  recentIndexHistory: [], relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null,
} as TherapyClientSummary;
vi.mock('../../api', () => ({ api: { getTherapyClients: () => Promise.resolve([CLIENT]) } }));

afterEach(() => { cleanup(); setScreenShare(false); });

/** Шапка и палитра, как их связывает оболочка: onSearch → ov.setCmdOpen(true). */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <ClientListHero count={1} formVisible={false} onToggle={() => {}} onSearch={() => setOpen(true)} />
      {open && <CommandPalette onNavigate={vi.fn()} onClose={() => setOpen(false)} userRole="THERAPIST" therapistMode />}
    </MemoryRouter>
  );
}
const openByLoupe = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Перейти к…' }));
  await act(async () => { await Promise.resolve(); });
};

describe('ClientListHero — лупа палитры', () => {
  it('клик по лупе зовёт onSearch; без onSearch лупы нет', () => {
    const onSearch = vi.fn();
    const { rerender } = render(<ClientListHero count={1} formVisible={false} onToggle={() => {}} onSearch={onSearch} />);
    const loupe = screen.getByRole('button', { name: 'Перейти к…' });
    expect(loupe.querySelector('svg')).not.toBeNull();
    fireEvent.click(loupe);
    expect(onSearch).toHaveBeenCalledTimes(1);
    rerender(<ClientListHero count={1} formVisible={false} onToggle={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Перейти к…' })).toBeNull();
  });

  it('лупа открывает палитру с клиентами', async () => {
    render(<Harness />);
    await openByLoupe();
    expect(screen.getByText('Иван')).toBeTruthy();
  });

  it('в «Показе экрана» палитра из лупы — как раньше: клиентов нет', async () => {
    setScreenShare(true);
    render(<Harness />);
    await openByLoupe();
    expect(screen.queryByText('Иван')).toBeNull();
    expect(screen.getByText('Клиенты скрыты: включён показ экрана')).toBeTruthy();
  });
});
