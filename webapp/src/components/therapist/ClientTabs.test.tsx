// @vitest-environment jsdom
// T-11 (QA 2026-11): после перехода кнопкой с «Обзора» активная вкладка должна
// оказаться в видимой части полосы. До правки полоса не прокручивалась.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ClientTabs } from './ClientTabs';
import type { ClientDetail, ClientTab } from './clientSheetTypes';

const detailWith = (clientTab: ClientTab) => ({
  clientSchemaNotesData: [], clientModeNotesData: [], clientTasks: [], clientDiary: [],
  notesPage: { notes: [], total: 0 }, clientData: null, clientTab, setClientTab: vi.fn(),
}) as unknown as ClientDetail;

describe('ClientTabs', () => {
  it('активная вкладка встаёт по центру полосы прокруткой самой полосы; смена вкладки — снова', () => {
    const { rerender } = render(<ClientTabs detail={detailWith('overview')} />);
    const bar = screen.getByRole('tablist');
    Object.defineProperty(bar, 'clientWidth', { configurable: true, value: 390 });
    Object.defineProperty(bar, 'scrollWidth', { configurable: true, value: 900 });
    const ysq = screen.getByRole('tab', { name: 'Схемы' });
    Object.defineProperty(ysq, 'offsetLeft', { configurable: true, value: 600 });
    Object.defineProperty(ysq, 'offsetWidth', { configurable: true, value: 80 });
    rerender(<ClientTabs detail={detailWith('ysq')} />);
    expect(bar.scrollLeft).toBe(445);
    // За правым краем ещё «Записи клиента», за левым — первые вкладки: маска с обеих сторон.
    expect(bar.className).toContain('is-fade-start');
    expect(bar.className).toContain('is-fade-end');
  });

  it('счётчик вкладки — тихий: класс tk-count, только при числе > 0', () => {
    render(<ClientTabs detail={{ ...detailWith('overview'), clientTasks: [{}, {}] } as unknown as ClientDetail} />);
    expect(screen.getByRole('tab', { name: /^Задания/ }).querySelector('.tk-count')!.textContent).toBe('2');
    expect(screen.getByRole('tab', { name: 'Сессии' }).querySelector('.ds-count')).toBeNull();
  });

  it('вкладка холстов — «Графические карты» между «Концептуализацией» и «Сессиями» (#963)', () => {
    const detail = detailWith('overview');
    render(<ClientTabs detail={detail} />);
    const names = screen.getAllByRole('tab').map(t => t.textContent);
    expect(names.slice(1, 4)).toEqual(['Концептуализация', 'Графические карты', 'Сессии']);
    expect(screen.queryByRole('tab', { name: 'Карта режимов' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Графические карты' }));
    expect(detail.setClientTab).toHaveBeenCalledWith('mode_map');
  });
});
