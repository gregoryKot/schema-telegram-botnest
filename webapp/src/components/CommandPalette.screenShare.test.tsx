// @vitest-environment jsdom
// «Перейти к…» при включённом «Показе экрана» (appShell/screenShareMode): клиентов нет
// ни списком, ни по поиску, иначе ⌘K на демонстрации экрана выложил бы всех клиентов разом.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TherapyClientSummary } from '../api';
import { CommandPalette } from './CommandPalette';
import { setScreenShare } from './appShell/screenShareMode';

const CLIENT: TherapyClientSummary = {
  telegramId: 42, name: 'Иван', clientAlias: null, streak: 3,
  lastActiveDate: null, todayIndex: null, recentIndexHistory: [],
  relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null,
};
const getTherapyClients = vi.fn(() => Promise.resolve([CLIENT]));
vi.mock('../api', () => ({ api: { getTherapyClients: () => getTherapyClients() } }));

afterEach(() => { cleanup(); setScreenShare(false); });

async function renderPalette() {
  render(
    <MemoryRouter>
      <CommandPalette onNavigate={vi.fn()} onClose={vi.fn()} userRole="THERAPIST" therapistMode />
    </MemoryRouter>,
  );
  await act(async () => { await Promise.resolve(); }); // список клиентов пришёл
}
const NOTE = 'Клиенты скрыты: включён показ экрана';

describe('CommandPalette — «Показ экрана»', () => {
  it('клиентов нет ни списком, ни по поиску; вместо них — подпись почему', async () => {
    setScreenShare(true);
    await renderPalette();
    expect(screen.queryByText('Иван')).toBeNull();
    expect(screen.getByText(NOTE)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Найти/), { target: { value: 'ива' } });
    expect(screen.queryByText('Иван')).toBeNull();
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
  });

  it('контроль: без режима клиент на месте и подписи нет; выключение возвращает его сразу', async () => {
    await renderPalette();
    expect(screen.getByText('Иван')).toBeTruthy();
    expect(screen.queryByText(NOTE)).toBeNull();
    act(() => setScreenShare(true));
    expect(screen.queryByText('Иван')).toBeNull();
    act(() => setScreenShare(false));
    expect(screen.getByText('Иван')).toBeTruthy();
  });
});
