// @vitest-environment jsdom
// Знаки бумажной аппликации в карточке клиента (владелец 2026-11-07: «на скрине нет
// ничего из картинок стиля»). Пустая вкладка показывает знак своей сущности рядом с
// текстом, а не одинаковую чашку: YSQ и пустой «Обзор» — слои, записи клиента —
// камешки (docs/design/PAPER_2026-11.md, «Мотив → смысл»). Шапка карточки — без
// картинки (PAPER, принцип 1): имя, мета и «Встреча» на месте, знака нет.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientYSQTab } from './ClientYSQTab';
import { ClientNotesTab } from './ClientNotesTab';
import { ClientOverviewTab } from './ClientOverviewTab';
import { ClientHeader } from './ClientHeader';
import type { ClientDetail } from './clientSheetTypes';
import type { TherapyClientSummary } from '../../api';
import { paperSignName } from '../../test-support/paperSign';

beforeEach(() => { window.innerWidth = 1024; });
afterEach(cleanup);

const offline = { telegramId: -1, name: 'Анна', clientAlias: null, streak: 0, meetingDays: [], nextSession: null, therapyStartDate: null } as unknown as TherapyClientSummary;
const online = { ...offline, telegramId: 7 } as unknown as TherapyClientSummary;
const emptySign = (root: HTMLElement) => paperSignName(root.querySelector('.pp-empty svg'));

const ysq = (client: TherapyClientSummary) => render(
  <ClientYSQTab clientData={null} selectedClient={client} selfSchemaIds={[]} ysqSchemaIds={[]}
    ysqRequested={false} ysqError="" exportCopied={false} handleRequestYsq={vi.fn()} handleExport={vi.fn()} />,
);

describe('пустые вкладки карточки клиента: знак сущности и текст', () => {
  it('«Схемы» без YSQ у офлайн-клиента: слои, заголовок и причина рядом со знаком, кнопки запроса нет', () => {
    const { container } = ysq(offline);
    expect(emptySign(container)).toBe('Layers');
    const text = container.querySelector('.pp-empty-text')!;
    expect(text.textContent).toBe('Тест на схемы ещё не пройденУ офлайн-клиента нет аккаунта – тест пройти негде');
    expect(screen.queryByRole('button', { name: 'Запросить тест на схемы' })).toBeNull();
  });

  it('«Схемы» без YSQ у клиента в приложении: слои, подсказка о запросе в той же строке, кнопка под ней', () => {
    const { container } = ysq(online);
    expect(emptySign(container)).toBe('Layers');
    expect(container.querySelector('.pp-empty-text')!.textContent).toMatch(/^Тест на схемы ещё не пройденЗапроси тест/);
    expect(screen.getByRole('button', { name: 'Запросить тест на схемы' })).toBeTruthy();
  });

  it('«Записи клиента» без единой записи: камешки и текст', () => {
    const { container } = render(<ClientNotesTab clientDiary={[]} clientModeNotesData={[]} clientSchemaNotesData={[]} />);
    expect(emptySign(container)).toBe('Pebbles');
    expect(screen.getByText('Клиент ещё не заполнял дневник')).toBeTruthy();
  });

  it('пустой «Обзор»: слои концептуализации и путь к ней', () => {
    const detail = {
      clientHistory: [], clientDiary: [], notes: [], localConcept: {}, concept: null, activeSchemaIds: [], activeModeIds: [],
      exportCopied: false, setShowAssign: vi.fn(), setClientTab: vi.fn(), handleExport: vi.fn(),
    } as unknown as ClientDetail;
    const { container } = render(<MemoryRouter><ClientOverviewTab selectedClient={offline} detail={detail} /></MemoryRouter>);
    expect(emptySign(container.querySelector('.tk-col') as HTMLElement)).toBe('Layers');
    expect(screen.getByText('Заполни концептуализацию, чтобы увидеть схемы и режимы клиента')).toBeTruthy();
  });
});

describe('шапка карточки клиента', () => {
  it('рендерится: имя, «офлайн», «Встреча» с датой и вкладки; картинок в шапке нет', () => {
    const client = { ...offline, nextSession: '2099-11-11T09:00', meetingDays: [3] } as unknown as TherapyClientSummary;
    const detail = {
      clientSchemaNotesData: [], clientModeNotesData: [], clientTasks: [], notesPage: { notes: [], total: 0 },
      clientData: null, clientDiary: [], clientTab: 'mode_map', renamingAlias: false, confirmingDelete: false,
      deleteLoading: false, deleteError: '', setShowAssign: vi.fn(), setClientTab: vi.fn(),
    } as unknown as ClientDetail;
    const { container } = render(<MemoryRouter><ClientHeader selectedClient={client} detail={detail} switchView={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Анна' })).toBeTruthy();
    expect(screen.getByText('офлайн')).toBeTruthy();
    expect(screen.getByText('Встреча')).toBeTruthy();
    expect(container.querySelector('.tc-meeting-val')!.textContent).toMatch(/11 ноя/);
    expect(screen.getByRole('tab', { name: 'Графические карты' }).getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('.tk-head svg.pp-art')).toBeNull();
  });
});
