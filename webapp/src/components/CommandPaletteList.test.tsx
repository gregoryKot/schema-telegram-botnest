// @vitest-environment jsdom
// Список ⌘K со знаками (b04): знак быстрого действия — знак его сущности (литералы — сверка с таблицей
// вида здесь, правило №4), подпись группы — один раз над первой строкой группы, клиент — кружок с
// инициалами, пусто — чашка, а при «Показе экрана» — одна строка почему, без второй «Ничего не найдено».
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ENTITY_LOOK, QUICK_ACTION_ENTITY } from '../../../shared/src/theme/entityLook';
import { QUICK_ACTION_IDS } from '../../../shared/src/quickActions/quickActions';
import { CmdList, type CmdRow } from './CommandPaletteList';
import { QUICK_ACTION_SIGN } from './quickActionSign';

const row = (over: Partial<CmdRow>): CmdRow => ({ label: 'Строка', mark: { sign: 'cup' }, search: '', action: vi.fn(), ...over });

describe('QUICK_ACTION_SIGN', () => {
  it.each([...QUICK_ACTION_IDS])('%s — знак сущности действия', (id) => {
    expect(QUICK_ACTION_SIGN[id]).toBe(ENTITY_LOOK[QUICK_ACTION_ENTITY[id]].sign);
  });
});

describe('CmdList', () => {
  it('подпись группы — один раз, над первой строкой группы', () => {
    render(<CmdList rows={[row({ label: 'Сегодня' }), row({ label: 'А', group: 'Записать момент' }), row({ label: 'Б', group: 'Записать момент' }), row({ label: 'В', group: 'Успокоиться' })]}
                    sel={0} onSelect={vi.fn()} onRun={vi.fn()} />);
    expect(screen.getAllByText('Записать момент')).toHaveLength(1);
    expect(screen.getAllByText('Успокоиться')).toHaveLength(1);
    const order = Array.from(document.querySelectorAll('.cmd-group, .cmd-label')).map(n => n.textContent);
    expect(order).toEqual(['Сегодня', 'Записать момент', 'А', 'Б', 'Успокоиться', 'В']);
  });

  it('строка — знак по ключу (svg) или кружок с инициалами; декор скрыт от скринридера', () => {
    const { container } = render(<CmdList rows={[row({ mark: { sign: 'strokes' } }), row({ mark: { initials: 'ИП', hue: 240 } })]}
                                          sel={0} onSelect={vi.fn()} onRun={vi.fn()} />);
    const marks = container.querySelectorAll('.cmd-mark');
    expect(marks[0].querySelector('svg.pp-art--row')).toBeTruthy();
    expect(marks[1].textContent).toBe('ИП');
    expect(Array.from(marks).every(m => m.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('пусто — чашка и «Ничего не найдено»; с пояснением «Показа экрана» — только оно', () => {
    const { container, rerender } = render(<CmdList rows={[]} sel={0} onSelect={vi.fn()} onRun={vi.fn()} />);
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    expect(container.querySelector('.cmd-empty svg')).toBeTruthy();
    rerender(<CmdList rows={[]} sel={0} onSelect={vi.fn()} onRun={vi.fn()} note="Клиенты скрыты" />);
    expect(screen.getByText('Клиенты скрыты')).toBeTruthy();
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
  });
});
