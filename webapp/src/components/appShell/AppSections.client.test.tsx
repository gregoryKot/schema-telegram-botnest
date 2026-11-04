// @vitest-environment jsdom
// T-12 / T-13 (QA 2026-11): прямой вход на /cabinet/<id> не пушит лишнюю запись
// истории; «← Все клиенты» из списка возвращает записью истории (позиция
// списка сохраняется), а не пушит новую.
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation, type NavigateFunction } from 'react-router-dom';
import { useRef } from 'react';
import { AppSections } from './AppSections';

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

let loc: ReturnType<typeof useLocation> | null = null;

function Host() {
  const nav: NavigateFunction = useNavigate();
  loc = useLocation();
  const back = useRef(() => {});
  const seg = loc.pathname.split('/')[2];
  const id = seg && seg !== 'today' ? Number(seg) : null;
  return (
    <AppSections
      inert={false} therapistMode pathname={loc.pathname} section="today" needs={[]} ratings={{}} displayName={null}
      navigate={nav} openClientId={id as never} switchTherapistMode={() => {}} therapistBackHandlerRef={back}
      setTherapistClients={() => {}} setSection={() => {}} ov={{} as never} todayRefreshKey={0} userRole="THERAPIST"
      profileRefreshKey={0} childhoodRatings={{}} helpTasksKey={0} setHelpTasksKey={() => {}}
    />
  );
}

const mount = (entries: string[]) =>
  render(<MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}><Host /></MemoryRouter>);

const click = (el: HTMLElement) => act(() => { el.click(); });

describe('AppSections: карточка клиента', () => {
  it('повторное открытие уже открытой карточки ничего не пушит', async () => {
    mount(['/cabinet/42']);
    const before = loc!.key;
    click(await screen.findByText('открыть 42'));
    expect(loc!.key).toBe(before);
  });

  it('из списка открывается с fromList, «все клиенты» возвращает шагом назад', async () => {
    mount(['/cabinet']);
    const listKey = loc!.key;
    click(await screen.findByText('открыть 42'));
    expect(loc!.pathname).toBe('/cabinet/42');
    click(screen.getByText('все клиенты'));
    await act(async () => {});
    expect(loc!.pathname).toBe('/cabinet');
    expect(loc!.key).toBe(listKey);
  });

  it('без метки (пришли не из списка) «все клиенты» ведёт на список', async () => {
    mount(['/cabinet/today', '/cabinet/42']);
    click(await screen.findByText('все клиенты'));
    await act(async () => {});
    expect(loc!.pathname).toBe('/cabinet');
  });
});
