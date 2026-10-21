// @vitest-environment jsdom
// PatternSheet (сайт) — единый экран паттерна: тап по «Моим схемам/режимам»
// больше не уводит сразу в упражнение или справку. Парный по смыслу с
// schema-miniapp/src/components/patternSheet/PatternSheet.test.tsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PatternSheet } from './PatternSheet';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';
import type { PatternEntries } from '../../sections/schemas/usePatternEntries';
import type { MyCardItem } from '../../../../shared/src/pattern/useMyCards';

const deleteSchemaDiary = vi.fn().mockResolvedValue(undefined);
const deleteModeDiary = vi.fn().mockResolvedValue(undefined);
vi.mock('../../api', () => ({
  api: {
    deleteSchemaDiary: (...a: unknown[]) => deleteSchemaDiary(...a),
    deleteModeDiary: (...a: unknown[]) => deleteModeDiary(...a),
    trackEvent: vi.fn(),
  },
}));
vi.mock('../SchemaDetailSheet', () => ({
  SchemaDetailSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="schema-detail"><button onClick={onClose}>close-schema-detail</button></div>
  ),
}));
vi.mock('../exercises/FlashcardEx', () => ({
  SchemaEx: ({ initialSchemaId, initialData, onBack, onComplete }: { initialSchemaId?: string; initialData?: Record<string, string>; onBack: () => void; onComplete?: () => void }) => (
    <div data-testid="schema-ex" data-initial={JSON.stringify(initialData ?? null)}>{initialSchemaId}
      <button onClick={onComplete}>complete</button><button onClick={onBack}>back-ex</button></div>
  ),
  ModeEx: ({ initialModeId }: { initialModeId?: string }) => <div data-testid="mode-ex">{initialModeId}</div>,
}));
vi.mock('../practice/QuickPracticeSheet', () => ({
  QuickPracticeSheet: ({ id }: { id: string }) => <div data-testid="practice">{id}</div>,
}));
vi.mock('../../share/ShareCardSheet', () => ({
  ShareCardSheet: ({ title }: { title: string }) => <div data-testid="share-sheet">{title}</div>,
}));

afterEach(() => { cleanup(); deleteSchemaDiary.mockClear(); deleteModeDiary.mockClear(); });

const FILLED: MyCardItem = {
  id: 'abandonment', name: 'Покинутость', subtitle: 'Нарушение связи и отвержение', color: '#000000',
  excerpt: 'Когда не отвечают', cardFields: [{ label: 'Что включает', text: 'Когда не отвечают' }],
  values: { triggers: 'Когда не отвечают' },
};

const schemaEntry = (id: number, schemaIds: string[]): SchemaDiaryEntry =>
  ({ id, createdAt: '2026-01-01T10:00:00.000Z', trigger: `Триггер ${id}`, emotions: [], schemaIds });
const modeEntry = (id: number, modeId: string): ModeDiaryEntry =>
  ({ id, createdAt: '2026-01-01T10:00:00.000Z', modeId, situation: `Ситуация ${id}` });

const entriesOf = (over: Partial<PatternEntries>): PatternEntries => ({
  schemaEntries: [], setSchemaEntries: vi.fn(), modeEntries: [], setModeEntries: vi.fn(), ...over,
});

function renderSheet(over: Partial<React.ComponentProps<typeof PatternSheet>> = {}) {
  const props = {
    kind: 'schema' as const, id: 'abandonment', items: [] as MyCardItem[], reload: vi.fn(),
    entries: entriesOf({}),
    onClose: vi.fn(), ...over,
  };
  render(<MemoryRouter><PatternSheet {...props} /></MemoryRouter>);
  return props;
}

describe('PatternSheet — карточка', () => {
  it('пустая: объяснение и «Заполнить карточку», без «Поделиться»', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: 'Покинутость / Нестабильность' })).toBeTruthy();
    expect(screen.getByText('Заполнить карточку')).toBeTruthy();
    expect(screen.queryByText('Поделиться')).toBeNull();
    expect(screen.queryByText('Дополнить')).toBeNull();
  });

  it('заполненная: поля из заметки, «Дополнить» и «Поделиться»', () => {
    renderSheet({ items: [FILLED] });
    expect(screen.getByText('Что включает')).toBeTruthy();
    expect(screen.getByText('Дополнить')).toBeTruthy();
    expect(screen.queryByText('Заполнить карточку')).toBeNull();
    fireEvent.click(screen.getByText('Поделиться'));
    expect(screen.getByTestId('share-sheet').textContent).toBe('Карточка схемы');
  });

  it('пока заметки грузятся — не пишет «пусто» и не предлагает «Заполнить»', () => {
    renderSheet({ loading: true });
    expect(screen.queryByText('Заполнить карточку')).toBeNull();
  });

  it('«Заполнить» открывает упражнение схемы с этой схемой; после «готово» карточки перечитываются', async () => {
    const p = renderSheet();
    fireEvent.click(screen.getByText('Заполнить карточку'));
    const ex = await screen.findByTestId('schema-ex');
    expect(ex.textContent).toContain('abandonment');
    fireEvent.click(screen.getByText('complete'));
    expect(p.reload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('back-ex'));
    expect(p.reload).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('schema-ex')).toBeNull();
  });

  it('«Дополнить» открывает опросник с уже написанным — сохранение не затрёт карточку пустыми полями', async () => {
    renderSheet({ items: [FILLED] });
    fireEvent.click(screen.getByText('Дополнить'));
    const ex = await screen.findByTestId('schema-ex');
    expect(JSON.parse(ex.getAttribute('data-initial')!)).toEqual({ triggers: 'Когда не отвечают' });
  });

  it('режим: «Заполнить» открывает упражнение режима', async () => {
    renderSheet({ kind: 'mode', id: 'vulnerable_child' });
    fireEvent.click(screen.getByText('Заполнить карточку'));
    expect((await screen.findByTestId('mode-ex')).textContent).toBe('vulnerable_child');
  });
});

describe('PatternSheet — записи дневника', () => {
  it('показывает только записи с этой схемой; пусто — текстом', () => {
    renderSheet({ entries: entriesOf({ schemaEntries: [schemaEntry(1, ['abandonment']), schemaEntry(2, ['mistrust'])] }) });
    expect(screen.getByText(/Триггер 1/)).toBeTruthy();
    expect(screen.queryByText(/Триггер 2/)).toBeNull();
    cleanup();
    renderSheet({ entries: entriesOf({ schemaEntries: [schemaEntry(2, ['mistrust'])] }) });
    expect(screen.getByText('Записей с этой схемой пока нет.')).toBeTruthy();
  });

  it('режим: фильтр по modeId', () => {
    renderSheet({ kind: 'mode', id: 'vulnerable_child', entries: entriesOf({ modeEntries: [modeEntry(1, 'vulnerable_child'), modeEntry(2, 'angry_child')] }) });
    expect(screen.getByText(/Ситуация 1/)).toBeTruthy();
    expect(screen.queryByText(/Ситуация 2/)).toBeNull();
  });

  it('удаление: API зовётся только после подтверждения «Удалить навсегда»', async () => {
    renderSheet({ entries: entriesOf({ schemaEntries: [schemaEntry(1, ['abandonment'])] }) });
    fireEvent.click(screen.getByText(/Триггер 1/)); // раскрыть карточку
    fireEvent.click(screen.getByText('Удалить'));
    expect(deleteSchemaDiary).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Удалить навсегда'));
    await waitFor(() => expect(deleteSchemaDiary).toHaveBeenCalledWith(1));
  });
});

describe('PatternSheet — справка и «О схеме»', () => {
  it('«О схеме» открывает детальный лист, закрытие возвращает на экран паттерна', () => {
    renderSheet();
    fireEvent.click(screen.getByText('О схеме →'));
    expect(screen.getByTestId('schema-detail')).toBeTruthy();
    fireEvent.click(screen.getByText('close-schema-detail'));
    expect(screen.queryByTestId('schema-detail')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Покинутость / Нестабильность' })).toBeTruthy();
  });

  it('«О режиме» открывает портрет режима', () => {
    renderSheet({ kind: 'mode', id: 'vulnerable_child' });
    fireEvent.click(screen.getByText('О режиме →'));
    expect(screen.getAllByText('Заполнить карточку →').length).toBeGreaterThan(0);
  });

  it('быстрая практика открывается из блока «Что поможет»', () => {
    renderSheet();
    fireEvent.click(screen.getAllByRole('button').find((b) => b.className === 'ps-pill')!);
    expect(screen.getByTestId('practice')).toBeTruthy();
  });

  it('«Назад» вызывает onClose', async () => {
    const p = renderSheet();
    fireEvent.click(screen.getByText('Назад'));
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
  });
});
