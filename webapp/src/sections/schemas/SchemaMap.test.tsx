// @vitest-environment jsdom
// «Полная карта» — аккордеоны MapFold на бумаге домена (b15; сам MapFold — components/schemaSheets/MapFold.test.tsx);
// «Паттерн недели» — лист бумаги паттерна.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaMap } from './SchemaMap';
import { WeekPatternCard } from './WeekPatternCard';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { DOMAIN_HUE, MODE_GROUP_HUE } from '../../lib/tone';

afterEach(cleanup);

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
