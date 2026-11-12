// @vitest-environment jsdom
// «Обзор» карточки клиента (#906; живая бумага — b30): цель — лист соломы, схемы и режимы — группы на бумаге
// домена и группы режимов со своим знаком (SignGroup, как у клиента в «Моих паттернах»), без цветных
// квадратиков-буллетов; пустые группы режимов не рисуются; заметка и записи — белые листы, у записи — знак
// типа (noteLook) и тип тихой подписью вместо плашки; пустой «Обзор» — сцена и одна кнопка.
// «Карта режимов» показывает режимы из концептуализации, поэтому «Редактировать →»
// ведёт туда, где их правят, — во вкладку «Концептуализация», а не на холст
// (QA 2026-10-26: ссылка открывала пустой холст).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { ClientOverviewTab } from './ClientOverviewTab';
import type { ClientDetail } from './clientSheetTypes';
import type { TherapyClientSummary } from '../../api';

afterEach(cleanup);

const client = { telegramId: -1, name: 'Анна', streak: 0, meetingDays: [], nextSession: null } as unknown as TherapyClientSummary;
const detailOf = (o: Partial<ClientDetail> = {}) =>
  ({
    clientHistory: [], clientDiary: [], notes: [], localConcept: {}, concept: null,
    activeSchemaIds: [], activeModeIds: [], exportCopied: false,
    setShowAssign: vi.fn(), setClientTab: vi.fn(), handleExport: vi.fn(),
    ...o,
  }) as unknown as ClientDetail;

describe('ClientOverviewTab', () => {
  it('цель, схемы, режимы, заметка и записи — подписи-заголовки h2; группы — бумага со знаком, без точек тона', () => {
    const { container } = render(
      <ClientOverviewTab selectedClient={client} detail={detailOf({
        localConcept: { goals: 'Меньше самокритики' },
        activeSchemaIds: ['abandonment', 'emotional_deprivation'],
        activeModeIds: ['vulnerable_child'],
        notes: [{ id: 1, date: '2026-10-20', text: 'Текст заметки' }],
        clientDiary: [{ type: 'gratitude', date: '2026-10-21', excerpt: 'Спасибо за день' }],
      } as unknown as Partial<ClientDetail>)} />,
    );
    const col = container.querySelector('.tk-col') as HTMLElement;
    expect(within(col).getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['Цель терапии', 'Активные схемы', 'Карта режимов', 'Заметка сессии', 'Последние записи']);
    // Белых карточек с рамкой и цветных точек больше нет.
    expect(col.querySelector('.ds-card, .ds-dot, .tone-tint, .tone-fill, .ds-chip')).toBeNull();
    // Цель — лист соломы.
    const goal = screen.getByText('Меньше самокритики');
    expect(goal.className).toBe('tk-text');
    expect((goal.closest('.pp-paper') as HTMLElement).style.getPropertyValue('--h')).toBe('70');
    // Схемы: один домен — лист его бумаги со знаком, две строки; счётчик — в шапке секции.
    expect(screen.getByText('2 в работе').className).toBe('ds-sub');
    const domain = screen.getByText('Нарушение связи и отвержение').closest('.sg-group') as HTMLElement;
    expect(domain.style.getPropertyValue('--h')).toBe('28');
    expect(domain.querySelector('.sg-sign svg')).toBeTruthy();
    expect(domain.querySelectorAll('.tk-item').length).toBe(2);
    // Режимы: только группа с активными режимами, бумага группы.
    const modes = screen.getByText('Карта режимов').closest('section') as HTMLElement;
    expect(modes.querySelectorAll('.sg-group').length).toBe(1);
    expect(screen.queryByText('—')).toBeNull();
    expect(within(modes).getByRole('button', { name: 'Редактировать →' }).className).toBe('ds-link');
    // Записи: знак типа, заголовок, тип тихой подписью, фрагмент и дата.
    const row = col.querySelector('.tk-entry') as HTMLElement;
    expect(row.querySelector('.pp-row-art svg')).toBeTruthy();
    expect(row.querySelector('.ds-list-title')!.textContent).toBe('Благодарность');
    expect(row.querySelector('.tk-entry-type')!.textContent).toBe('Благодарность');
    expect(row.querySelector('.tk-entry-excerpt')!.textContent).toBe('Спасибо за день');
    expect(row.querySelector('.tk-entry-date')).toBeTruthy();
  });

  it('пустой «Обзор» — сцена, текст и одно действие «Открыть концептуализацию»', () => {
    const setClientTab = vi.fn();
    const { container } = render(<ClientOverviewTab selectedClient={client} detail={detailOf({ setClientTab })} />);
    const col = container.querySelector('.tk-col') as HTMLElement;
    expect(within(col).queryAllByRole('heading')).toEqual([]);
    expect(col.querySelector('.tk-empty-scene svg.scn')).toBeTruthy();
    expect(col.querySelector('.tk-empty-text')!.textContent).toContain('концептуализацию');
    expect(within(col).getAllByRole('button').map(b => b.textContent)).toEqual(['Открыть концептуализацию']);
    within(col).getByRole('button', { name: 'Открыть концептуализацию' }).click();
    expect(setClientTab).toHaveBeenCalledWith('concept');
  });

  it('«Карта режимов» → «Редактировать →» открывает концептуализацию, а не холст', () => {
    const setClientTab = vi.fn();
    render(<ClientOverviewTab selectedClient={client} detail={detailOf({ setClientTab, activeModeIds: ['vulnerable_child', 'punitive_critic'] })} />);
    fireEvent.click(screen.getByText('Редактировать →'));
    expect(setClientTab).toHaveBeenCalledWith('concept');
    expect(setClientTab).not.toHaveBeenCalledWith('mode_map');
  });
});
