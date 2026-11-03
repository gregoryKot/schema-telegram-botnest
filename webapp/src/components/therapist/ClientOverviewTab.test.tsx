// @vitest-environment jsdom
// «Обзор» карточки клиента (#906, волна 1): секции — карточки с подписью
// ds-label, без плиток с заливкой, кавычки-глифа и заголовков второго кегля;
// схемы и режимы — строками с точкой тона, пустые группы режимов не рисуются;
// записи клиента — строки ds-list-row; пустой «Обзор» — ds-empty.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
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

const labels = (root: HTMLElement) => Array.from(root.querySelectorAll('.tk-col .ds-label')).map(el => el.textContent);

describe('ClientOverviewTab', () => {
  it('цель, схемы, режимы, заметка и записи — карточки с подписью; плиток и глифов нет, подписи — заголовки h2', () => {
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
    expect(labels(col)).toEqual(['Цель терапии', 'Активные схемы', 'Карта режимов', 'Заметка сессии', 'Последние записи']);
    expect(within(col).getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual(['Цель терапии', 'Активные схемы', 'Карта режимов', 'Заметка сессии', 'Последние записи']);
    expect(col.querySelector('.tk-tile, .tk-quote, .tk-mode-col, .tone-soft, .tone-border')).toBeNull();
    expect(col.querySelectorAll(':scope > .ds-card').length).toBe(5);
    // Цель — обычный текст, без кавычки-глифа.
    const goal = screen.getByText('Меньше самокритики');
    expect(goal.className).toBe('tk-text');
    expect(col.textContent).not.toContain('“');
    // Схемы: один домен, две строки с точкой тона; счётчик — в шапке карточки.
    expect(screen.getByText('2 в работе').className).toBe('ds-sub');
    const schemas = screen.getByText('Активные схемы').closest('.ds-card') as HTMLElement;
    expect(schemas.querySelectorAll('.tk-item .ds-dot.tone-fill').length).toBe(2);
    expect(within(schemas).getByText('Нарушение связи и отвержение').className).toBe('ds-sub');
    // Режимы: только группа с активными режимами, пустых групп с «—» нет.
    const modes = screen.getByText('Карта режимов').closest('.ds-card') as HTMLElement;
    expect(modes.querySelectorAll('.tk-group').length).toBe(1);
    expect(modes.querySelectorAll('.tk-item .ds-dot.tone-fill').length).toBe(1);
    expect(screen.queryByText('—')).toBeNull();
    expect(within(modes).getByRole('button', { name: 'Редактировать →' }).className).toBe('ds-link');
    // Записи: строка-переход с чипом типа, заголовком и датой.
    const row = col.querySelector('.ds-list-row.tk-entry') as HTMLElement;
    expect(row.querySelector('.ds-chip.ds-chip--sm.tone-tint')!.textContent).toBe('Благодарность');
    expect(row.querySelector('.ds-list-title')!.textContent).toBe('Благодарность');
    expect(row.querySelector('.ds-list-sub')!.textContent).toBe('Спасибо за день');
    expect(row.querySelector('.ds-sub:last-child')).toBeTruthy();
  });

  it('пустой «Обзор» — ds-empty и одно действие «Открыть концептуализацию»', () => {
    const setClientTab = vi.fn();
    const { container } = render(<ClientOverviewTab selectedClient={client} detail={detailOf({ setClientTab })} />);
    const col = container.querySelector('.tk-col') as HTMLElement;
    expect(labels(col)).toEqual([]);
    expect(col.querySelector('.ds-empty')!.textContent).toContain('концептуализацию');
    within(col).getByRole('button', { name: 'Открыть концептуализацию' }).click();
    expect(setClientTab).toHaveBeenCalledWith('concept');
  });
});
