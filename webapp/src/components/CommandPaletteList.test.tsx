// @vitest-environment jsdom
// Список ⌘K со знаками (b04): знак быстрого действия — знак его сущности по таблице вида, подпись
// группы — один раз над первой строкой группы, клиент — кружок с инициалами, пусто — чашка, а при
// «Показе экрана» — одна строка почему, без второй «Ничего не нашлось».
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ENTITY_LOOK, QUICK_ACTION_ENTITY } from '../../../shared/src/theme/entityLook';
import { QUICK_ACTION_IDS } from '../../../shared/src/quickActions/quickActions';
import { CmdList, type CmdRow } from './CommandPaletteList';
import { quickActionSign } from './quickActionSign';

const row = (over: Partial<CmdRow>): CmdRow => ({ kind: 'section', group: 'Разделы', label: 'Строка', mark: { sign: 'cup' }, search: '', action: vi.fn(), ...over });

describe('quickActionSign', () => {
  it.each([...QUICK_ACTION_IDS])('%s — знак сущности действия', (id) => {
    expect(quickActionSign(id)).toBe(ENTITY_LOOK[QUICK_ACTION_ENTITY[id]].sign);
  });
});

describe('CmdList', () => {
  it('подпись группы — один раз, над первой строкой группы', () => {
    render(<CmdList rows={[row({ label: 'Сегодня' }), row({ label: 'Записи' }), row({ label: 'А', group: 'Записать момент' }), row({ label: 'Б', group: 'Записать момент' }), row({ label: 'В', group: 'Успокоиться' })]}
                    sel={0} onSelect={vi.fn()} onRun={vi.fn()} />);
    expect(screen.getAllByText('Записать момент')).toHaveLength(1);
    expect(screen.getAllByText('Успокоиться')).toHaveLength(1);
    const order = Array.from(document.querySelectorAll('.cmd-group, .cmd-label')).map(n => n.textContent);
    expect(order).toEqual(['Разделы', 'Сегодня', 'Записи', 'Записать момент', 'А', 'Б', 'Успокоиться', 'В']);
  });

  it('строка — знак по ключу (svg) или кружок с инициалами; декор скрыт от скринридера', () => {
    const { container } = render(<CmdList rows={[row({ mark: { sign: 'strokes' } }), row({ mark: { initials: 'ИП', hue: 240 } })]}
                                          sel={0} onSelect={vi.fn()} onRun={vi.fn()} />);
    const marks = container.querySelectorAll('.cmd-mark');
    expect(marks[0].querySelector('svg.pp-art--row')).toBeTruthy();
    expect(marks[1].textContent).toBe('ИП');
    expect(Array.from(marks).every(m => m.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('без запроса — что ищется и примеры-чипы; тап по чипу отдаёт запрос; при запросе с результатами их нет', () => {
    const onExample = vi.fn();
    const props = { sel: 0, onSelect: vi.fn(), onRun: vi.fn(), help: 'Разделы и действия', examples: ['Недоверие'], onExample };
    const { rerender } = render(<CmdList rows={[row({ after: 'Ещё 3 — начни вводить имя' })]} {...props} />);
    expect(screen.getByText('Разделы и действия')).toBeTruthy();
    expect(screen.getByText('Ещё 3 — начни вводить имя')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Недоверие' }));
    expect(onExample).toHaveBeenCalledWith('Недоверие');
    rerender(<CmdList rows={[row({})]} {...props} searching />);
    expect(screen.queryByRole('button', { name: 'Недоверие' })).toBeNull();
    expect(screen.queryByText('Разделы и действия')).toBeNull();
    // ничего не нашлось — подсказка и те же примеры возвращаются
    rerender(<CmdList rows={[]} {...props} searching />);
    expect(screen.getByText('Ничего не нашлось')).toBeTruthy();
    expect(screen.getByText('Здесь ищутся: разделы и действия')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Недоверие' })).toBeTruthy();
  });

  it('пусто — чашка и «Ничего не нашлось»; с пояснением «Показа экрана» — только оно', () => {
    const { container, rerender } = render(<CmdList rows={[]} sel={0} onSelect={vi.fn()} onRun={vi.fn()} />);
    expect(screen.getByText('Ничего не нашлось')).toBeTruthy();
    expect(container.querySelector('.cmd-empty svg')).toBeTruthy();
    rerender(<CmdList rows={[]} sel={0} onSelect={vi.fn()} onRun={vi.fn()} note="Клиенты скрыты" />);
    expect(screen.getByText('Клиенты скрыты')).toBeTruthy();
    expect(screen.queryByText('Ничего не нашлось')).toBeNull();
  });
});
