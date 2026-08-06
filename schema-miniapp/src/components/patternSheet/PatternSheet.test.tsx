// @vitest-environment jsdom
// PatternSheet — единый экран паттерна (правило CLAUDE.md: тап по паттерну
// больше никогда не открывает опросник напрямую, только явная кнопка).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PatternSheet } from './PatternSheet';
import type { SchemaDiaryEntry } from '../../types';
import type { MyCardItem } from '../myCards/useMyCards';

const deleteSchemaDiary = vi.fn().mockResolvedValue(undefined);
const deleteModeDiary = vi.fn().mockResolvedValue(undefined);
vi.mock('../../api', () => ({
  api: {
    deleteSchemaDiary: (...a: unknown[]) => deleteSchemaDiary(...a),
    deleteModeDiary: (...a: unknown[]) => deleteModeDiary(...a),
    trackEvent: vi.fn(),
  },
}));

vi.mock('../SchemaIntroSheet', () => ({
  SchemaIntroSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="schema-intro">
      <button onClick={onClose}>close-schema-intro</button>
    </div>
  ),
}));
vi.mock('../ModeIntroSheet', () => ({
  ModeIntroSheet: ({
    onClose,
    forcePortrait,
  }: {
    onClose: () => void;
    forcePortrait?: boolean;
  }) => (
    <div data-testid="mode-intro">
      {forcePortrait ? 'portrait' : 'wizard'}
      <button onClick={onClose}>close-mode-intro</button>
    </div>
  ),
}));
vi.mock('../SchemaDetailSheet', () => ({
  SchemaDetailSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="schema-detail">
      <button onClick={onClose}>close-schema-detail</button>
    </div>
  ),
}));
vi.mock('../../share/ShareCardSheet', () => ({
  ShareCardSheet: ({ title }: { title: string }) => (
    <div data-testid="share-sheet">{title}</div>
  ),
}));

afterEach(() => {
  cleanup();
  deleteSchemaDiary.mockClear();
  deleteModeDiary.mockClear();
});

const FILLED_ITEM: MyCardItem = {
  id: 'abandonment',
  name: 'Покинутость',
  subtitle: 'Отчуждение и отвержение',
  color: '#5aa8f7',
  excerpt: 'Когда не отвечают',
  cardFields: [{ label: 'Что включает', text: 'Когда не отвечают' }],
};

function schemaEntry(id: number, schemaIds: string[]): SchemaDiaryEntry {
  return {
    id,
    createdAt: '2026-01-01T10:00:00.000Z',
    trigger: `Триггер ${id}`,
    emotions: [],
    schemaIds,
  };
}

describe('PatternSheet — карточка заполнена', () => {
  it('показывает ответы, кнопку «Дополнить» и «Поделиться» (не «Заполнить»)', () => {
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[FILLED_ITEM]}
        reload={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Когда не отвечают')).toBeTruthy();
    expect(screen.getByText('Дополнить')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Поделиться' })).toBeTruthy();
    expect(screen.queryByText('Заполнить карточку')).toBeNull();
  });

  it('«Дополнить» открывает опросник SchemaIntroSheet, а не что-то ещё', () => {
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[FILLED_ITEM]}
        reload={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByTestId('schema-intro')).toBeNull();
    fireEvent.click(screen.getByText('Дополнить'));
    expect(screen.getByTestId('schema-intro')).toBeTruthy();
  });

  it('закрытие опросника вызывает reload (read-after-write)', () => {
    const reload = vi.fn();
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[FILLED_ITEM]}
        reload={reload}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Дополнить'));
    fireEvent.click(screen.getByText('close-schema-intro'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('«Поделиться» открывает ShareCardSheet', () => {
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[FILLED_ITEM]}
        reload={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
    expect(screen.getByTestId('share-sheet').textContent).toBe(
      'Карточка схемы',
    );
  });
});

describe('PatternSheet — карточка пустая', () => {
  it('нет заметки для id → объяснение и одна кнопка «Заполнить карточку»', () => {
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[]}
        reload={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Заполнить карточку')).toBeTruthy();
    expect(screen.queryByText('Дополнить')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Поделиться' })).toBeNull();
  });

  it('«Заполнить карточку» открывает опросник, тап по паттерну сам его не открывает', () => {
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[]}
        reload={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByTestId('schema-intro')).toBeNull();
    fireEvent.click(screen.getByText('Заполнить карточку'));
    expect(screen.getByTestId('schema-intro')).toBeTruthy();
  });
});

describe('PatternSheet — записи дневника только этого паттерна', () => {
  it('фильтрует schemaEntries по id (в т.ч. записи с несколькими схемами)', () => {
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[]}
        reload={() => {}}
        schemaEntries={[
          schemaEntry(1, ['abandonment']),
          schemaEntry(2, ['mistrust']),
          schemaEntry(3, ['mistrust', 'abandonment']),
        ]}
        setSchemaEntries={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Триггер 1')).toBeTruthy();
    expect(screen.getByText('Триггер 3')).toBeTruthy();
    expect(screen.queryByText('Триггер 2')).toBeNull();
  });

  it('честное пустое состояние — без выдуманных примеров', () => {
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[]}
        reload={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Записей с этой схемой пока нет.')).toBeTruthy();
  });

  it('удаление записи зовёт api.deleteSchemaDiary и вычищает её из state', () => {
    const setSchemaEntries = vi.fn();
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[]}
        reload={() => {}}
        schemaEntries={[schemaEntry(1, ['abandonment'])]}
        setSchemaEntries={setSchemaEntries}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Триггер 1'));
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Удалить навсегда'));
    expect(deleteSchemaDiary).toHaveBeenCalledWith(1);
    expect(setSchemaEntries).toHaveBeenCalled();
  });
});

describe('PatternSheet — ссылка «О схеме»/«О режиме»', () => {
  it('«О схеме» открывает SchemaDetailSheet (энциклопедию), не опросник', () => {
    render(
      <PatternSheet
        kind="schema"
        id="abandonment"
        items={[]}
        reload={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('О схеме →'));
    expect(screen.getByTestId('schema-detail')).toBeTruthy();
    expect(screen.queryByTestId('schema-intro')).toBeNull();
  });

  it('«О режиме» открывает ModeIntroSheet с forcePortrait — портрет, а не сразу вопросы', () => {
    render(
      <PatternSheet
        kind="mode"
        id="demanding_critic"
        items={[]}
        reload={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('О режиме →'));
    expect(screen.getByTestId('mode-intro').textContent).toContain('portrait');
  });
});
