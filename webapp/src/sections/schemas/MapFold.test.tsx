// @vitest-environment jsdom
// «Полная карта» и «Карта режимов» — аккордеоны на бумаге домена/группы (b15): свёрнуты по умолчанию,
// знак у шапки — из вида домена/группы, своя схема — с галочкой; «Паттерн недели» — лист бумаги паттерна.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MapFold } from './MapFold';
import { SchemaMap } from './SchemaMap';
import { WeekPatternCard } from './WeekPatternCard';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { DOMAIN_HUE, MODE_GROUP_HUE } from '../../lib/tone';

afterEach(cleanup);

const TILES = [
  { id: 'a', name: 'Схема А', desc: 'описание А', isMine: true },
  { id: 'b', name: 'Схема Б', desc: 'описание Б', isMine: false },
];

describe('MapFold', () => {
  it('свёрнут по умолчанию; шапка раскрывает и сворачивает плитки', () => {
    render(<MapFold look={{ hue: 28, sign: 'domain_rejection' }} title="Домен" meta="1 из 2 отмечены" tiles={TILES} onOpen={vi.fn()} />);
    const head = screen.getByRole('button', { name: /Домен/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Схема А')).toBeNull();
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Схема Б')).toBeTruthy();
    fireEvent.click(head);
    expect(screen.queryByText('Схема Б')).toBeNull();
  });

  it('своя — бумагой с галочкой (is-mine), чужая — без; тап открывает описание по id', () => {
    const open = vi.fn();
    render(<MapFold look={{ hue: 28 }} title="Домен" tiles={TILES} onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: /Домен/ }));
    const mine = screen.getByRole('button', { name: /Схема А/ });
    const other = screen.getByRole('button', { name: /Схема Б/ });
    expect(mine.classList.contains('is-mine')).toBe(true);
    expect(mine.querySelector('.cs-tile-check')).toBeTruthy();
    expect(other.classList.contains('is-mine')).toBe(false);
    expect(other.querySelector('.cs-tile-check')).toBeNull();
    fireEvent.click(other);
    expect(open).toHaveBeenCalledWith('b');
  });
});

describe('SchemaMap — домены аккордеонами', () => {
  it('по листу на домен, бумага — оттенок домена; подпись из данных', () => {
    const { container } = render(<SchemaMap mineIds={['abandonment']} onOpenSchema={vi.fn()} />);
    const folds = container.querySelectorAll<HTMLElement>('.cs-mapfold');
    expect(folds).toHaveLength(SCHEMA_DOMAINS.length);
    expect(folds[0].style.getPropertyValue('--h')).toBe(String(DOMAIN_HUE[SCHEMA_DOMAINS[0].id]));
    expect(screen.getByText(`1 из ${SCHEMA_DOMAINS[0].schemas.length} отмечены`)).toBeTruthy();
  });
});

describe('WeekPatternCard — герой паттерна недели', () => {
  it('схема: лист бумаги и знак домена; весь лист — тап-цель', () => {
    const open = vi.fn();
    const { container } = render(<WeekPatternCard top={{ kind: 'schema', id: 'abandonment', days: 2, windowDays: 7 }} onOpen={open} />);
    const sheet = container.querySelector<HTMLElement>('.pa-sheet')!;
    expect(sheet.getAttribute('data-sign')).toBe('domain_rejection');
    expect(sheet.style.getPropertyValue('--h')).toBe(String(DOMAIN_HUE.rejection));
    fireEvent.click(screen.getByRole('button'));
    expect(open).toHaveBeenCalledWith('schema', 'abandonment');
  });

  it('режим: бумага группы и знак группы', () => {
    const { container } = render(<WeekPatternCard top={{ kind: 'mode', id: 'punitive_critic', days: 3, windowDays: 7 }} onOpen={vi.fn()} />);
    const sheet = container.querySelector<HTMLElement>('.pa-sheet')!;
    expect(sheet.getAttribute('data-sign')).toBe('looming');
    expect(sheet.style.getPropertyValue('--h')).toBe(String(MODE_GROUP_HUE.critic));
  });
});
