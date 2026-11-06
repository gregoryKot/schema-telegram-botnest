// @vitest-environment jsdom
// T-11 (QA 2026-11): после перехода кнопкой с «Обзора» активная вкладка должна
// оказаться в видимой части полосы. До правки полоса не прокручивалась.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ClientTabs } from './ClientTabs';
import type { ClientDetail, ClientTab } from './clientSheetTypes';

const scrollIntoView = vi.fn();
beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView as never;
});

const detailWith = (clientTab: ClientTab) => ({
  clientSchemaNotesData: [], clientModeNotesData: [], clientTasks: [], clientDiary: [],
  notesPage: { notes: [], total: 0 }, clientData: null, clientTab, setClientTab: vi.fn(),
}) as unknown as ClientDetail;

describe('ClientTabs', () => {
  it('активная вкладка прокручивается к центру полосы, смена вкладки — снова', () => {
    const { rerender } = render(<ClientTabs detail={detailWith('overview')} />);
    rerender(<ClientTabs detail={detailWith('ysq')} />);
    const last = scrollIntoView.mock.instances[scrollIntoView.mock.instances.length - 1] as HTMLElement;
    expect(last.textContent).toContain('Схемы');
    expect(scrollIntoView).toHaveBeenLastCalledWith(expect.objectContaining({ inline: 'center', block: 'nearest' }));
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
