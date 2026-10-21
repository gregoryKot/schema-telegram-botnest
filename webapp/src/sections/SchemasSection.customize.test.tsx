// @vitest-environment jsdom
// «Паттерны» на сайте × «Настроить экран»: «Подсказка сверху» и «Тест на схемы»
// скрываются и переставляются (те же ключи localStorage и события, что у
// мини-аппа). Порядок и скрытие проверяются на живых карточках, связка
// «переключил в листе → карточка исчезла» — через настоящий лист.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mobile = vi.hoisted(() => ({ value: true }));
vi.mock('../components/useIsMobile', () => ({ useIsMobile: () => mobile.value }));
vi.mock('../utils/uiPrefsSync', () => ({ notifyPrefsChanged: vi.fn() }));
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));
vi.mock('./schemas/useSchemasData', () => ({
  useSchemasData: () => ({
    loading: false, saveFailed: false, ysqSchemaIds: ['s'], manualSchemaIds: [], ysqScores: {}, ysqCompletedAt: null,
    ysqProgressAnswered: null, myModeIds: [], myMapCount: 0, saveSchemas: vi.fn(), saveModes: vi.fn(),
  }),
}));
vi.mock('./schemas/usePatternLayer', () => ({
  usePatternLayer: () => ({
    layer: null, openPattern: vi.fn(), openModeEx: vi.fn(), schemaFreq: {}, modeFreq: {}, top: null,
    entriesReady: true, hasEntries: true, statusOf: () => ({ filled: new Set(), statusFor: undefined }),
  }),
}));
const stub = vi.hoisted(() => (name: string) => () => <div data-testid={name} />);
vi.mock('./schemas/ExpressedCard', () => ({ ExpressedCard: stub('expressed') }));
vi.mock('./schemas/MySchemasList', () => ({ MySchemasList: stub('my-list') }));
vi.mock('./schemas/MySchemasBlock', () => ({ MySchemasBlock: stub('my-chips') }));
vi.mock('./schemas/SchemaMap', () => ({ SchemaMap: stub('map') }));
vi.mock('./schemas/ModesBlocks', () => ({ ModesBlocks: stub('modes') }));
vi.mock('./schemas/NeedsBlock', () => ({ NeedsBlock: stub('needs') }));
vi.mock('../components/SchemaPickerSheet', () => ({ SchemaPickerSheet: stub('p1') }));
vi.mock('../components/ModePickerSheet', () => ({ ModePickerSheet: stub('p2') }));
vi.mock('../components/SchemaDetailSheet', () => ({ SchemaDetailSheet: stub('p3') }));
vi.mock('../components/NeedDetailSheet', () => ({ NeedDetailSheet: stub('p4') }));

import { api } from '../api';
import { SchemasSection } from './SchemasSection';

const track = () => api.trackEvent as unknown as ReturnType<typeof vi.fn>;
const hero = () => document.querySelector('.cs-intro');
const row = () => document.querySelector('.cs-testrow');
const before = (a: Element | null, b: Element | null) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

function renderPatterns() {
  return render(<MemoryRouter><SchemasSection onOpenSchema={vi.fn()} /></MemoryRouter>);
}

beforeEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); mobile.value = true; });

describe('«Паттерны» × «Настроить экран», телефон', () => {
  it('по умолчанию подсказка стоит выше строки теста', () => {
    renderPatterns();
    expect(before(hero(), row())).toBe(true);
  });

  it('сохранённый порядок ставит строку теста выше подсказки', () => {
    localStorage.setItem('screen_order_patterns', '["ysq_status","heroes"]');
    renderPatterns();
    expect(before(row(), hero())).toBe(true);
  });

  it('скрытая подсказка не рисуется, строка теста остаётся; и наоборот', () => {
    localStorage.setItem('screen_hidden_patterns', '["heroes"]');
    renderPatterns();
    expect(hero()).toBeNull();
    expect(row()).not.toBeNull();
    cleanup();
    localStorage.setItem('screen_hidden_patterns', '["ysq_status"]');
    renderPatterns();
    expect(row()).toBeNull();
    expect(hero()).not.toBeNull();
  });

  it('шестерёнка открывает лист с двумя блоками; тумблер прячет подсказку, ручка меняет порядок', async () => {
    renderPatterns();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран' }));
    expect(await screen.findByRole('dialog', { name: 'Настроить экран' })).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(2);
    expect(track()).toHaveBeenCalledWith('screen_customize_open', { screen: 'patterns', via: 'gear' });

    fireEvent.keyDown(screen.getByRole('button', { name: 'Переставить: Тест на схемы' }), { key: 'ArrowUp' });
    expect(before(row(), hero())).toBe(true);
    expect(localStorage.getItem('screen_order_patterns')).toBe('["ysq_status","heroes"]');
    expect(track()).toHaveBeenCalledWith('screen_block_move', { screen: 'patterns', block: 'ysq_status', dir: 'up' });

    fireEvent.click(screen.getByRole('switch', { name: 'Подсказка сверху' }));
    expect(hero()).toBeNull();
    expect(localStorage.getItem('screen_hidden_patterns')).toBe('["heroes"]');
    expect(track()).toHaveBeenCalledWith('screen_block_toggle', { screen: 'patterns', block: 'heroes', hidden: true });
  });
});

describe('«Паттерны» × «Настроить экран», десктоп', () => {
  beforeEach(() => { mobile.value = false; });

  it('ссылка «Настроить экран» в шапке открывает лист; ручек порядка в нём нет', async () => {
    renderPatterns();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран' }));
    expect(await screen.findByRole('dialog', { name: 'Настроить экран' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Переставить/ })).toBeNull();
  });

  it('карточка теста рядом с выраженными схемами скрывается тумблером, подсказка остаётся', async () => {
    renderPatterns();
    expect(document.querySelector('.cs-test')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран' }));
    fireEvent.click(await screen.findByRole('switch', { name: 'Тест на схемы' }));
    expect(document.querySelector('.cs-test')).toBeNull();
    expect(hero()).not.toBeNull();
  });
});
