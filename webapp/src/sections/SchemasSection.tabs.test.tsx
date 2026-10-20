// @vitest-environment jsdom
// «Паттерны» на телефоне: вкладки Схемы / Режимы / Потребности — в каждой только
// своё; на десктопе вкладок нет и виден весь экран.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const mobile = vi.hoisted(() => ({ value: true }));
vi.mock('../components/useIsMobile', () => ({ useIsMobile: () => mobile.value }));
vi.mock('./schemas/useSchemasData', () => ({
  useSchemasData: () => ({
    loading: false, saveFailed: false, ysqSchemaIds: ['s'], manualSchemaIds: [], ysqScores: {}, ysqCompletedAt: null,
    ysqProgressAnswered: null, myModeIds: [], myMapCount: 1, saveSchemas: vi.fn(), saveModes: vi.fn(),
  }),
}));
vi.mock('./schemas/usePatternLayer', () => ({
  usePatternLayer: () => ({
    layer: null, openPattern: vi.fn(), openModeEx: vi.fn(), schemaFreq: {}, modeFreq: {}, top: null, modeTop: null,
    entriesReady: true, hasEntries: true, statusOf: () => ({ filled: new Set(), statusFor: undefined }),
  }),
}));
const stub = vi.hoisted(() => (name: string) => () => <div data-testid={name} />);
vi.mock('./schemas/PatternsTopCards', () => ({ PatternsTopCards: stub('hero') }));
vi.mock('./schemas/ModesTopCards', () => ({ ModesTopCards: stub('modes-hero') }));
vi.mock('./schemas/ExpressedCard', () => ({ ExpressedCard: stub('expressed') }));
vi.mock('./schemas/YsqTestRow', () => ({ YsqTestRow: stub('test-row') }));
vi.mock('./schemas/YsqTestCard', () => ({ YsqTestCard: stub('test-card') }));
vi.mock('./schemas/MySchemasList', () => ({ MySchemasList: stub('my-list') }));
vi.mock('./schemas/MySchemasBlock', () => ({ MySchemasBlock: stub('my-chips') }));
vi.mock('./schemas/SchemaMap', () => ({ SchemaMap: stub('map') }));
vi.mock('./schemas/ModesBlocks', () => ({ ModesBlocks: stub('modes') }));
vi.mock('./schemas/MyModesList', () => ({ MyModesList: stub('my-modes') }));
vi.mock('./schemas/ModeMap', () => ({ ModeMap: stub('modes-map') }));
vi.mock('./schemas/ModeMapBanner', () => ({ ModeMapBanner: stub('mode-map'), MyModeMapSheet: stub('mode-map-sheet') }));
vi.mock('./schemas/NeedsBlock', () => ({ NeedsBlock: stub('needs') }));
vi.mock('../components/SchemaPickerSheet', () => ({ SchemaPickerSheet: stub('p1') }));
vi.mock('../components/ModePickerSheet', () => ({ ModePickerSheet: stub('p2') }));
vi.mock('../components/SchemaDetailSheet', () => ({ SchemaDetailSheet: stub('p3') }));
vi.mock('../components/NeedDetailSheet', () => ({ NeedDetailSheet: stub('p4') }));

import { SchemasSection } from './SchemasSection';

const ids = () => Array.from(document.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid'));

beforeEach(() => { cleanup(); localStorage.clear(); mobile.value = true; });

describe('SchemasSection: вкладки на телефоне', () => {
  it('«Схемы» по умолчанию: строка теста, схемы списком, карта под сворачиванием', () => {
    render(<SchemasSection onOpenSchema={vi.fn()} />);
    expect(ids()).toEqual(['hero', 'test-row', 'expressed', 'my-list']);
    expect(screen.getByRole('tab', { name: 'Схемы' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Паттерны');
  });
  it('карта схем свёрнута и раскрывается по «Все N схем»', () => {
    render(<SchemasSection onOpenSchema={vi.fn()} />);
    expect(screen.queryByTestId('map')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Все \d+ схем/ }));
    expect(screen.getByTestId('map')).toBeTruthy();
  });
  it('«Режимы» — подсказка сверху, мои режимы строками и баннер; полная карта свёрнута', () => {
    render(<SchemasSection onOpenSchema={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Режимы' }));
    expect(ids()).toEqual(['modes-hero', 'my-modes', 'mode-map']);
    expect(screen.queryByTestId('modes-map')).toBeNull();
  });
  it('карта режимов раскрывается по «Все режимы»', () => {
    render(<SchemasSection onOpenSchema={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Режимы' }));
    fireEvent.click(screen.getByRole('button', { name: /^Все режимы/ }));
    expect(screen.getByTestId('modes-map')).toBeTruthy();
  });
  it('«Потребности» — только потребности, вкладка запоминается', () => {
    const { unmount } = render(<SchemasSection onOpenSchema={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Потребности' }));
    expect(ids()).toEqual(['needs']);
    unmount();
    render(<SchemasSection onOpenSchema={vi.fn()} />);
    expect(ids()).toEqual(['needs']);
  });
});

describe('SchemasSection: десктоп', () => {
  it('вкладок нет, виден весь экран прежним составом', () => {
    mobile.value = false;
    render(<SchemasSection onOpenSchema={vi.fn()} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(ids()).toEqual(['hero', 'expressed', 'test-card', 'my-chips', 'map', 'modes', 'mode-map', 'needs']);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Мои паттерны');
  });
});
