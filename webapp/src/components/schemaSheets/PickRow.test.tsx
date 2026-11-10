// @vitest-environment jsdom
// Листы «Мои схемы / Мои режимы» (b15): группы на бумаге домена/группы со знаком, выбранная строка —
// бумага с галочкой (aria-pressed), «Готово · N» в шапке считает выбранное.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PickRow, PickDone } from './PickRow';
import { SignGroup } from './SignGroup';
import { SchemaPickerSheet } from '../SchemaPickerSheet';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';

afterEach(cleanup);

describe('PickRow', () => {
  it('выбранная — is-selected и aria-pressed; тап переключает', () => {
    const toggle = vi.fn();
    const { rerender } = render(<PickRow name="Покинутость" active={false} onToggle={toggle} />);
    const row = screen.getByRole('button', { name: /Покинутость/ });
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(row.classList.contains('is-selected')).toBe(false);
    fireEvent.click(row);
    expect(toggle).toHaveBeenCalledTimes(1);
    rerender(<PickRow name="Покинутость" active onToggle={toggle} />);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(row.classList.contains('is-selected')).toBe(true);
  });
});

describe('PickDone', () => {
  it('без выбора — «Готово», с выбором — «Готово · N»', () => {
    const { rerender } = render(<PickDone count={0} onClick={vi.fn()} />);
    expect(screen.getByRole('button').textContent).toBe('Готово');
    rerender(<PickDone count={3} onClick={vi.fn()} />);
    expect(screen.getByRole('button').textContent).toBe('Готово · 3');
  });
});

describe('SignGroup', () => {
  it('лист бумаги вида группы, подпись и число; без знака — без слота знака', () => {
    const { container } = render(<SignGroup look={{ hue: 240 }} title="Группа" aside={2}><span>строка</span></SignGroup>);
    const group = container.querySelector<HTMLElement>('.sg-group')!;
    expect(group.style.getPropertyValue('--h')).toBe('240');
    expect(screen.getByText('Группа')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(container.querySelector('.sg-sign')).toBeNull();
  });

  it('один знак — слот у подписи; несколько (signs) — ряд знаков и шапка с переносом; signs из одного — как один', () => {
    const one = render(<SignGroup look={{ hue: 240, sign: 'Yield' }} title="Одна"><span /></SignGroup>);
    expect(one.container.querySelectorAll('.sg-sign')).toHaveLength(1);
    expect(one.container.querySelector('.sg-signs')).toBeNull();
    expect(one.container.querySelector('.sg-head')!.classList.contains('is-many')).toBe(false);
    cleanup();
    const many = render(<SignGroup look={{ hue: 240 }} signs={['Yield', 'Shelter', 'Shield']} title="Копинги"><span /></SignGroup>);
    expect(many.container.querySelectorAll('.sg-signs .sg-sign')).toHaveLength(3);
    expect(many.container.querySelector('.sg-head')!.classList.contains('is-many')).toBe(true);
    cleanup();
    const single = render(<SignGroup look={{ hue: 240 }} signs={['Shield']} title="Один из списка"><span /></SignGroup>);
    expect(single.container.querySelectorAll('.sg-sign')).toHaveLength(1);
    expect(single.container.querySelector('.sg-signs')).toBeNull();
  });
});

describe('SchemaPickerSheet', () => {
  it('по листу на домен со знаком домена; «Готово · N» в шапке и «Готово» внизу закрывают', () => {
    const close = vi.fn();
    const { container } = render(
      <MemoryRouter><SchemaPickerSheet selected={['abandonment']} onSave={vi.fn()} onClose={close} /></MemoryRouter>,
    );
    expect(container.querySelectorAll('.sg-group')).toHaveLength(SCHEMA_DOMAINS.length);
    expect(container.querySelectorAll('.sg-sign')).toHaveLength(SCHEMA_DOMAINS.length);
    expect(screen.getByRole('button', { name: 'Готово · 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Готово' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Покинутость \/ Нестабильность/ }).getAttribute('aria-pressed')).toBe('true');
  });
});
