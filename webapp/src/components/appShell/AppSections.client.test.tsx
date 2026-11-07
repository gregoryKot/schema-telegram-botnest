// @vitest-environment jsdom
// T-12 / T-13 (QA 2026-11): прямой вход на /cabinet/<код> не пушит лишнюю запись
// истории; «← Все клиенты» из списка возвращает записью истории (позиция
// списка сохраняется), а не пушит новую.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation, type NavigateFunction } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AppSections } from './AppSections';
import { parseClientRef } from '../../../../shared/src/utils/clientRef';
import type { TherapyClientSummary } from '../../api';

interface SheetProps {
  onOpenClient: (id: number) => void;
  onViewChange: (v: 'list' | 'client') => void;
}
vi.mock('../TherapistClientSheet', () => ({
  TherapistClientSheet: (p: SheetProps) => (
    <div>
      <button onClick={() => p.onOpenClient(42)}>открыть 42</button>
      <button onClick={() => p.onViewChange('list')}>все клиенты</button>
    </div>
  ),
}));

vi.mock('../../sections/TherapistGuideSection', () => ({
  TherapistGuideSection: () => <h1>Справочник</h1>,
}));

const snap = { loc: null as ReturnType<typeof useLocation> | null };
let clients: TherapyClientSummary[] = [];
beforeEach(() => { clients = []; });

function Host() {
  const nav: NavigateFunction = useNavigate();
  const loc = useLocation();
  useEffect(() => { snap.loc = loc; });
  const back = useRef(() => {});
  const seg = loc.pathname.split('/')[2];
  const ref = seg && seg !== 'today' ? parseClientRef(seg) : null;
  return (
    <AppSections
      inert={false} therapistMode pathname={loc.pathname} section="today" needs={[]} ratings={{}} displayName={null}
      navigate={nav} openClientRef={ref} clients={clients} switchTherapistMode={() => {}} therapistBackHandlerRef={back}
      setTherapistClients={() => {}} setSection={() => {}} ov={{} as never} todayRefreshKey={0} userRole="THERAPIST"
      profileRefreshKey={0} childhoodRatings={{}} helpTasksKey={0} setHelpTasksKey={() => {}}
    />
  );
}

const mount = (entries: (string | { pathname: string; state: unknown })[]) =>
  render(<MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}><Host /></MemoryRouter>);

const click = (el: HTMLElement) => act(() => { el.click(); });

describe('AppSections: карточка клиента', () => {
  it('повторное открытие уже открытой карточки ничего не пушит', async () => {
    mount(['/cabinet/42']);
    const before = snap.loc!.key;
    click(await screen.findByText('открыть 42'));
    expect(snap.loc!.key).toBe(before);
  });

  it('из списка открывается с fromList, «все клиенты» возвращает шагом назад', async () => {
    mount(['/cabinet']);
    const listKey = snap.loc!.key;
    click(await screen.findByText('открыть 42'));
    expect(snap.loc!.pathname).toBe('/cabinet/42');
    click(screen.getByText('все клиенты'));
    await act(async () => {});
    expect(snap.loc!.pathname).toBe('/cabinet');
    expect(snap.loc!.key).toBe(listKey);
  });

  // Адрес карточки — постоянный код (shared/src/utils/clientRef.ts).
  it('из списка клиент с кодом открывается по адресу с кодом', async () => {
    clients = [{ telegramId: 42, urlCode: 'abcdefgh' } as TherapyClientSummary];
    mount(['/cabinet']);
    click(await screen.findByText('открыть 42'));
    expect(snap.loc!.pathname).toBe('/cabinet/abcdefgh');
  });

  it('старый числовой адрес заменяется кодом без новой записи; метка fromList остаётся', async () => {
    clients = [{ telegramId: 42, urlCode: 'abcdefgh' } as TherapyClientSummary];
    mount(['/cabinet', { pathname: '/cabinet/42', state: { fromList: true } }]);
    await act(async () => {});
    expect(snap.loc!.pathname).toBe('/cabinet/abcdefgh');
    expect(snap.loc!.state).toEqual({ fromList: true });
    click(screen.getByText('все клиенты'));
    await act(async () => {});
    expect(snap.loc!.pathname).toBe('/cabinet');
  });

  it('прямой вход по коду, пока список кабинета не пришёл: открытие этой карточки ничего не пушит', async () => {
    mount(['/cabinet/abcdefgh']);
    const before = snap.loc!.key;
    click(await screen.findByText('открыть 42'));
    expect(snap.loc!.key).toBe(before);
    expect(snap.loc!.pathname).toBe('/cabinet/abcdefgh');
  });

  it('без метки (пришли не из списка) «все клиенты» ведёт на список', async () => {
    mount(['/cabinet/today', '/cabinet/42']);
    click(await screen.findByText('все клиенты'));
    await act(async () => {});
    expect(snap.loc!.pathname).toBe('/cabinet');
  });
});

// «Справочник» терапевта (#995): /cabinet/guide — свой экран, не список клиентов
// (адрес подходит под /cabinet/:clientId, но клиентом «guide» не считается).
describe('AppSections: «Справочник»', () => {
  it('/cabinet/guide рисует справочник, без списка клиентов', async () => {
    mount(['/cabinet/guide']);
    expect(await screen.findByRole('heading', { name: 'Справочник' })).toBeTruthy();
    expect(screen.queryByText('все клиенты')).toBeNull();
  });

  it('/cabinet — список клиентов, справочника нет', async () => {
    mount(['/cabinet']);
    expect(await screen.findByText('все клиенты')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Справочник' })).toBeNull();
  });
});
