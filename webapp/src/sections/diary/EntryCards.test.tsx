// @vitest-environment jsdom
// Ж7 дизайн-аудита 2026-08: карточки записей дневника — раскрывашки
// (клик разворачивает подробности) без aria-expanded. Проверяем все три
// (схема/режим/благодарность) по одному образцу.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaEntry, ModeEntry, GratitudeEntry } from './EntryCards';
import { schemaEntryRows } from './entryRows';
import type {
  SchemaDiaryEntry,
  ModeDiaryEntry,
  GratitudeDiaryEntry,
} from '../../types';

afterEach(cleanup);

const SCHEMA_ENTRY: SchemaDiaryEntry = {
  id: 1,
  createdAt: new Date().toISOString(),
  trigger: 'Созвон с командой',
  emotions: [],
  schemaIds: [],
};

const MODE_ENTRY: ModeDiaryEntry = {
  id: 1,
  createdAt: new Date().toISOString(),
  modeId: 'vulnerable-child',
  situation: 'Позвонил папа',
};

const GRATITUDE_ENTRY: GratitudeDiaryEntry = {
  id: 1,
  date: '2026-08-01',
  items: ['Тёплый чай'],
  createdAt: new Date().toISOString(),
};

describe('EntryCards — aria-expanded на раскрывашках (Ж7)', () => {
  it('SchemaEntry: aria-expanded переключается по клику', () => {
    render(<SchemaEntry entry={SCHEMA_ENTRY} onDelete={() => {}} />);
    const card = screen.getByText('Созвон с командой').closest('[role="button"]')!;
    expect(card.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
  });

  it('ModeEntry: aria-expanded переключается по клику', () => {
    render(<ModeEntry entry={MODE_ENTRY} onDelete={() => {}} />);
    const card = screen.getByText('Позвонил папа').closest('[role="button"]')!;
    expect(card.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
  });

  it('ModeEntry из разбора подписан «Разбор», обычная запись — «Режим»', () => {
    const { unmount } = render(<ModeEntry entry={{ ...MODE_ENTRY, fromCase: true }} onDelete={() => {}} />);
    expect(screen.getByText('Разбор')).toBeTruthy();
    expect(screen.queryByText('Режим')).toBeNull();
    unmount();
    render(<ModeEntry entry={MODE_ENTRY} onDelete={() => {}} />);
    expect(screen.getByText('Режим')).toBeTruthy();
    expect(screen.queryByText('Разбор')).toBeNull();
  });

  it('GratitudeEntry: aria-expanded переключается по клику', () => {
    render(<GratitudeEntry entry={GRATITUDE_ENTRY} onDelete={() => {}} />);
    const card = screen.getByText('Тёплый чай').closest('[role="button"]')!;
    expect(card.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('EntryCards — «Мысль» без схем и эмоций', () => {
  it('заголовка «Без схемы» нет: бейдж «Мысль» и сразу текст', () => {
    render(<SchemaEntry entry={SCHEMA_ENTRY} onDelete={() => {}} />);
    expect(screen.getByText('Мысль')).toBeTruthy();
    expect(screen.queryByText('Без схемы')).toBeNull();
    expect(screen.getByText('Созвон с командой')).toBeTruthy();
  });

  it('запись с эмоциями, но без схем, остаётся «Дневником схем»', () => {
    render(<SchemaEntry entry={{ ...SCHEMA_ENTRY, emotions: [{ id: 'anxiety', intensity: 3 } as never] }} onDelete={() => {}} />);
    expect(screen.getByText('Дневник схем')).toBeTruthy();
  });
});

describe('EntryCards — все поля записи в раскрытой карточке (паритет с мини-аппом)', () => {
  it('SchemaEntry показывает чувства, схемы, происхождение и поля реакции', () => {
    const full: SchemaDiaryEntry = {
      ...SCHEMA_ENTRY,
      emotions: [{ id: 'anxiety', intensity: 3 } as never],
      schemaIds: ['abandonment'],
      schemaOrigin: 'Так было в детстве',
      realProblems: 'Дедлайн в пятницу',
      excessiveReactions: 'Накрутил себя',
      healthyBehavior: 'Написать коллеге',
    };
    const labels = schemaEntryRows(full).filter(([, t]) => t).map(([l]) => l);
    expect(labels).toEqual([
      'Чувства', 'Схемы', 'Происхождение', 'Реальные проблемы', 'Чрезмерные реакции', 'Здоровое поведение',
    ]);
    render(<SchemaEntry entry={full} onDelete={() => {}} />);
    fireEvent.click(screen.getByText('Созвон с командой').closest('[role="button"]')!);
    expect(screen.getByText('Так было в детстве')).toBeTruthy();
    expect(screen.getByText('Дедлайн в пятницу')).toBeTruthy();
    expect(screen.getByText('Написать коллеге')).toBeTruthy();
  });

  it('SchemaEntry: у пустой записи нет ни одного поля', () => {
    expect(schemaEntryRows(SCHEMA_ENTRY).filter(([, t]) => t)).toEqual([]);
  });

  it('ModeEntry показывает «Тело» и «Действия»', () => {
    const entry: ModeDiaryEntry = { ...MODE_ENTRY, bodyFeelings: 'Сжало живот', actions: 'Замолчал' };
    render(<ModeEntry entry={entry} onDelete={() => {}} />);
    fireEvent.click(screen.getByText('Позвонил папа').closest('[role="button"]')!);
    expect(screen.getByText('Сжало живот')).toBeTruthy();
    expect(screen.getByText('Замолчал')).toBeTruthy();
    expect(screen.getByText('Действия')).toBeTruthy();
  });
});
