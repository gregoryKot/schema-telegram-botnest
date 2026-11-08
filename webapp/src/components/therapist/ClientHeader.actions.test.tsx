// @vitest-environment jsdom
// Действия карточки клиента (#906, волна 1). «+ Задание» и «+ Заметка» — один
// компонент ClientQuickActions с одними обработчиками: на ноутбуке он в шапке,
// на телефоне — первой строкой «Обзора» (закреплённой панели над навигацией
// больше нет — решение владельца 2026-11-02 по скриншоту). Редкие действия —
// переименовать и удалить — в меню «⋯» шапки, иконок в шапке нет; подтверждение
// удаления — прежний ConfirmDialog. Ширина экрана — window.innerWidth (useIsMobile).
import { useState } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { ClientHeader } from './ClientHeader';
import { ClientOverviewTab } from './ClientOverviewTab';
import { ClientOverviewSidebar } from './ClientOverviewSidebar';
import type { ClientDetail, ClientTab } from './clientSheetTypes';
import type { TherapyClientSummary } from '../../api';

const DESKTOP = 1024;
const PHONE = 390;
beforeEach(() => { window.innerWidth = DESKTOP; });
afterEach(cleanup);

const client = { telegramId: -1, name: 'Анна', clientAlias: null, streak: 0, meetingDays: [], nextSession: null } as unknown as TherapyClientSummary;
const detailOf = (o: Partial<ClientDetail> = {}) =>
  ({
    clientSchemaNotesData: [], clientModeNotesData: [], clientTasks: [], notesPage: { notes: [], total: 0 },
    clientData: null, clientDiary: [], clientHistory: [], clientTab: 'overview', notes: [],
    localConcept: {}, concept: null, activeSchemaIds: [], activeModeIds: [],
    renamingAlias: false, confirmingDelete: false, deleteLoading: false, deleteError: '',
    editingNextSession: false, editingStartDate: false, exportCopied: false,
    setShowAssign: vi.fn(), setClientTab: vi.fn(), handleExport: vi.fn(),
    setRenamingAlias: vi.fn(), setAliasInput: vi.fn(), requestDeleteClient: vi.fn(),
    deleteClient: vi.fn(), cancelDeleteClient: vi.fn(),
    ...o,
  }) as unknown as ClientDetail;

const renderHeader = (detail: ClientDetail) =>
  render(
    <MemoryRouter>
      <ClientHeader selectedClient={client} detail={detail} switchView={vi.fn()} />
    </MemoryRouter>,
  );
const quick = () => [screen.queryByRole('button', { name: '+ Задание' }), screen.queryByRole('button', { name: '+ Заметка' })];

describe('«+ Задание / + Заметка»', () => {
  it('ноутбук: кнопки в шапке — «+ Задание» открывает назначение, «+ Заметка» — вкладку сессий; «Обзор» их не повторяет', () => {
    const setShowAssign = vi.fn();
    const setClientTab = vi.fn();
    const detail = detailOf({ setShowAssign, setClientTab });
    renderHeader(detail);
    expect(screen.getByRole('button', { name: '+ Задание' }).className).toBe('ds-btn ds-btn--sm');
    fireEvent.click(screen.getByRole('button', { name: '+ Задание' }));
    expect(setShowAssign).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: '+ Заметка' }));
    expect(setClientTab).toHaveBeenCalledWith('sessions');
    cleanup();
    render(<ClientOverviewTab selectedClient={client} detail={detail} />);
    expect(quick()).toEqual([null, null]);
  });

  it('телефон: в шапке кнопок нет, они первой строкой «Обзора» с теми же обработчиками', () => {
    window.innerWidth = PHONE;
    const setShowAssign = vi.fn();
    const setClientTab = vi.fn();
    const detail = detailOf({ setShowAssign, setClientTab });
    renderHeader(detail);
    expect(quick()).toEqual([null, null]);
    cleanup();
    const { container } = render(<ClientOverviewTab selectedClient={client} detail={detail} />);
    const row = container.querySelector('.tk-col')!.firstElementChild!;
    expect(row.className).toBe('tk-quick');
    const [assign, note] = within(row as HTMLElement).getAllByRole('button');
    expect([assign.textContent, note.textContent]).toEqual(['+ Задание', '+ Заметка']);
    expect(assign.className).toContain('ds-btn--secondary');
    expect(note.className).toContain('ds-btn--sm');
    fireEvent.click(assign);
    expect(setShowAssign).toHaveBeenCalledWith(true);
    fireEvent.click(note);
    expect(setClientTab).toHaveBeenCalledWith('sessions');
  });

  it('сайдбар «Обзора» не повторяет действия шапки', () => {
    const online = { ...client, telegramId: 7 } as TherapyClientSummary;
    render(<ClientOverviewSidebar selectedClient={online} detail={detailOf()} />);
    expect(screen.queryByRole('button', { name: /Задание/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Заметка/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Запросить тест на схемы' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Экспорт концепта' })).toBeTruthy();
  });

  // QA 2026-11: офлайн-клиенту кнопка вела во вкладку с «YSQ недоступен».
  it('сайдбар: офлайн-клиенту «Запросить тест на схемы» не показан, экспорт остаётся', () => {
    render(<ClientOverviewSidebar selectedClient={client} detail={detailOf()} />);
    expect(screen.queryByRole('button', { name: 'Запросить тест на схемы' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Экспорт концепта' })).toBeTruthy();
  });

  // QA 2026-11: на пустом концепте «Экспорт концепта» молча ничего не делал.
  it('сайдбар: пустой концепт — экспорт недоступен, причина строкой под кнопками', () => {
    const handleExport = vi.fn();
    render(<ClientOverviewSidebar selectedClient={client} detail={detailOf({ exportEmpty: true, handleExport })} />);
    const btn = screen.getByRole('button', { name: 'Экспорт концепта' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText('В концепте пока пусто — экспортировать нечего')).toBeTruthy();
    cleanup();
    render(<ClientOverviewSidebar selectedClient={client} detail={detailOf({ exportEmpty: false })} />);
    expect((screen.getByRole('button', { name: 'Экспорт концепта' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/экспортировать нечего/)).toBeNull();
  });
});

describe('меню «⋯» шапки', () => {
  it('содержит «Переименовать» и «Удалить клиента»; пункт закрывает меню и зовёт прежний обработчик', () => {
    const setRenamingAlias = vi.fn();
    const setAliasInput = vi.fn();
    const requestDeleteClient = vi.fn();
    renderHeader(detailOf({ setRenamingAlias, setAliasInput, requestDeleteClient }));
    expect(screen.queryByRole('menu')).toBeNull();
    const more = screen.getByRole('button', { name: 'Действия с карточкой' });
    expect(more.className).toContain('ds-btn--icon');
    fireEvent.click(more);
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['Переименовать', 'Удалить клиента']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Переименовать' }));
    expect(setRenamingAlias).toHaveBeenCalledWith(true);
    expect(setAliasInput).toHaveBeenCalledWith('Анна');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить клиента' }));
    expect(requestDeleteClient).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('фокус: «Отмена» в диалоге удаления возвращает его на «Действия с карточкой»', () => {
    function Harness() {
      const [confirming, setConfirming] = useState(false);
      return (
        <MemoryRouter>
          <ClientHeader selectedClient={client} switchView={vi.fn()}
            detail={detailOf({ confirmingDelete: confirming, requestDeleteClient: () => setConfirming(true), cancelDeleteClient: () => setConfirming(false) })} />
        </MemoryRouter>
      );
    }
    render(<Harness />);
    const more = screen.getByRole('button', { name: 'Действия с карточкой' });
    more.focus();
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить клиента' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Действия с карточкой' }));
  });

  it('иконок карандаша и корзины в шапке нет; пока удаление идёт, пункт недоступен', () => {
    renderHeader(detailOf({ deleteLoading: true }));
    expect(screen.queryByRole('button', { name: 'Переименовать' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Удалить клиента' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Действия с карточкой' }));
    expect((screen.getByRole('menuitem', { name: 'Удалить клиента' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('запрос удаления ведёт к прежнему подтверждению: ConfirmDialog с кнопкой «Удалить»', () => {
    const deleteClient = vi.fn();
    renderHeader(detailOf({ confirmingDelete: true, deleteClient }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Удалить клиента «Анна»?')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    expect(deleteClient).toHaveBeenCalled();
  });
});

// QA 2026-11: «Назад» браузера на «Удалить клиента?» уводил из карточки —
// диалог не писал запись в историю. Теперь «Назад» закрывает только диалог.
describe('подтверждение удаления и «Назад» браузера', () => {
  const nav: { go?: NavigateFunction; path?: string } = {};
  function Harness({ deleteClient = vi.fn() }: { deleteClient?: () => void }) {
    const [confirming, setConfirming] = useState(true);
    nav.go = useNavigate();
    nav.path = useLocation().pathname;
    return (
      <ClientHeader selectedClient={client} switchView={vi.fn()}
        detail={detailOf({ confirmingDelete: confirming, cancelDeleteClient: () => setConfirming(false), deleteClient })} />
    );
  }
  const renderAt = (deleteClient?: () => void) => render(
    <MemoryRouter initialEntries={['/cabinet', '/cabinet/-1']} initialIndex={1}><Harness deleteClient={deleteClient} /></MemoryRouter>,
  );
  const back = () => act(() => { void nav.go!(-1); });

  it('«Назад» закрывает диалог, карточка остаётся на месте, удаления нет', () => {
    const deleteClient = vi.fn();
    renderAt(deleteClient);
    expect(screen.getByRole('dialog')).toBeTruthy();
    back();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(nav.path).toBe('/cabinet/-1');
    expect(deleteClient).not.toHaveBeenCalled();
    back(); // следующий «Назад» — уже из карточки, без «мёртвой» записи
    expect(nav.path).toBe('/cabinet');
  });

  it('«Удалить» снимает запись диалога и удаляет; «Отмена» — закрывает без удаления', () => {
    const deleteClient = vi.fn();
    renderAt(deleteClient);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }));
    expect(deleteClient).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    back();
    expect(nav.path).toBe('/cabinet');
    cleanup();

    const other = vi.fn();
    renderAt(other);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(nav.path).toBe('/cabinet/-1');
    expect(other).not.toHaveBeenCalled();
    back();
    expect(nav.path).toBe('/cabinet');
  });
});

describe('шапка: имя и встреча', () => {
  it('имя — заголовок ds-h2, аватар — tint с инициалами, корень без модификаторов панели', () => {
    const { container } = renderHeader(detailOf());
    const name = screen.getByRole('heading', { name: 'Анна' });
    expect(name.className).toContain('ds-h2');
    const avatar = container.querySelector('.ds-avatar')!;
    expect(avatar.className).toContain('tone-tint');
    expect(avatar.textContent).toBe('А');
    expect(container.querySelector('.tk-head')!.className).toBe('tk-head');
    expect(container.querySelector('.tk-actions-main')).toBeNull();
  });
});

// Шапка не следует за вкладкой (владелец 2026-11-06). В #962 на «Графических
// картах» она уходила во всю ширину (tk-head--wide), и при переходе на любую
// другую вкладку прыгала вбок. Теперь шапка одна на все вкладки, а в колонку
// под неё встаёт полоса карт (therapist-card.css, сверка — therapistCard.test.ts).
describe('шапка одна на все вкладки', () => {
  const TABS: ClientTab[] = ['overview', 'concept', 'mode_map', 'sessions', 'tasks', 'ysq', 'client_notes'];
  it.each(TABS)('%s — тот же класс .tk-head без модификаторов', (clientTab) => {
    renderHeader(detailOf({ clientTab }));
    expect(screen.getByText('← Все клиенты').closest('.tk-head')!.className).toBe('tk-head');
  });
});
