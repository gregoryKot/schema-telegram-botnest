// Сборка строк общего поиска: группы и их порядок, лимит клиентов без запроса, листы справочника
// только в кабинете терапевта, клиенты скрыты при «Показе экрана».
import { describe, it, expect, vi } from 'vitest';
import type { TherapyClientSummary } from '../../api';
import { buildReference, type ReferenceTexts } from '../../sections/guide/guideReferenceModel';
import { buildReferenceBody } from '../../sections/guide/guideReferenceBody';
import { getSchemaById } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import {
  FIXTURE_GUIDE, FIXTURE_PRACTICE_NOTE, FIXTURE_SCHEMA_GUIDE, FIXTURE_TECHNIQUES,
} from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';
import { buildPaletteRows, paletteExamples, paletteHelp, CLIENTS_SHOWN, GROUP, type PaletteInput } from './paletteRows';

const tr = (ty: string) => ty;
const texts: ReferenceTexts = {
  buildModeGuides: () => [{ ...FIXTURE_GUIDE, modeId: 'vulnerable_child', what: 'Ребёнок остаётся один на один с тоской.' }],
  buildSchemaDomainGuides: () => [{ domainId: 'rejection', note: 'домен', schemas: [{ ...FIXTURE_SCHEMA_GUIDE, schemaId: 'abandonment' }] }],
  buildTechniqueGuides: () => FIXTURE_TECHNIQUES,
  practiceNotes: () => [FIXTURE_PRACTICE_NOTE],
};
const guide = { ref: buildReference(texts, tr), body: buildReferenceBody(texts, tr) };
const SCHEMA = getSchemaById('abandonment')!.name;

const client = (telegramId: number, name: string): TherapyClientSummary => ({
  telegramId, name, clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null, recentIndexHistory: [],
  relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
});
const CLIENTS = ['Анна', 'Борис', 'Вера', 'Глеб', 'Дина', 'Ева', 'Клим'].map((n, i) => client(i + 1, n));

const run = () => ({ section: vi.fn(), path: vi.fn(), client: vi.fn(), toggleMode: vi.fn(), quick: vi.fn(), guideSheet: vi.fn() });
const input = (over: Partial<PaletteInput>): PaletteInput => ({
  query: '', tr, therapist: true, therapistMode: true, screenShare: false, clients: CLIENTS, guide, run: run(), ...over,
});
const groups = (rows: { group: string }[]) => rows.map((r) => r.group).filter((g, i, all) => g !== all[i - 1]);
const labels = (rows: { label: string }[]) => rows.map((r) => r.label);

describe('buildPaletteRows — без запроса', () => {
  it('кабинет: первые клиенты и «Ещё N», разделы кабинета, действия; листов справочника нет', () => {
    const rows = buildPaletteRows(input({}));
    expect(groups(rows)).toEqual([GROUP.clients, GROUP.sections, GROUP.actions]);
    const clients = rows.filter((r) => r.kind === 'client');
    expect(labels(clients)).toEqual(['Анна', 'Борис', 'Вера', 'Глеб', 'Дина']);
    expect(clients[CLIENTS_SHOWN - 1].after).toBe('Ещё 2 — начни вводить имя');
    expect(labels(rows.filter((r) => r.kind === 'section'))).toEqual(['Сегодня', 'Справочник', 'Задания', 'Все клиенты']);
    expect(rows.some((r) => r.kind === 'guide')).toBe(false);
  });

  it('«вы» — строка «Ещё N» во множественном числе; клиентов не больше лимита — строки нет', () => {
    const vy = buildPaletteRows(input({ tr: (_ty, v) => v }));
    expect(vy.find((r) => r.after)?.after).toBe('Ещё 2 — начните вводить имя');
    expect(buildPaletteRows(input({ clients: CLIENTS.slice(0, CLIENTS_SHOWN) })).some((r) => r.after)).toBe(false);
  });

  it('клиент: разделы и быстрые действия группами реестра; ни клиентов, ни переключателя', () => {
    const rows = buildPaletteRows(input({ therapist: false, therapistMode: false, clients: [] }));
    expect(groups(rows)[0]).toBe(GROUP.sections);
    expect(groups(rows)).not.toContain(GROUP.clients);
    expect(groups(rows).length).toBeGreaterThan(2);
    expect(labels(rows)).not.toContain('Переключиться в кабинет терапевта');
  });

  it('«Показ экрана»: клиентов нет ни без запроса, ни по имени', () => {
    expect(buildPaletteRows(input({ screenShare: true })).some((r) => r.kind === 'client')).toBe(false);
    expect(buildPaletteRows(input({ screenShare: true, query: 'анна' }))).toEqual([]);
  });
});

describe('buildPaletteRows — запрос', () => {
  it('название схемы показывает группу «Справочник»; выбор строки зовёт переход с kind и id', () => {
    const handlers = run();
    const rows = buildPaletteRows(input({ query: 'покинутость', run: handlers }));
    expect(groups(rows)).toEqual([GROUP.guide]);
    expect(rows[0]).toMatchObject({ kind: 'guide', label: SCHEMA, sub: expect.stringContaining('Схемы') });
    rows[0].action();
    expect(handlers.guideSheet).toHaveBeenCalledWith({ kind: 'schema', id: 'abandonment' });
  });

  it('слово из текста листа: подзаголовок — кусок абзаца', () => {
    const [row] = buildPaletteRows(input({ query: 'тоской' }));
    expect(row).toMatchObject({ kind: 'guide', label: 'Уязвимый Ребёнок', sub: '…остаётся один на один с тоской.' });
  });

  it('листы справочника — только в кабинете терапевта и только когда тексты загружены', () => {
    expect(buildPaletteRows(input({ query: 'покинутость', therapistMode: false }))).toEqual([]);
    expect(buildPaletteRows(input({ query: 'покинутость', therapist: false, therapistMode: false }))).toEqual([]);
    expect(buildPaletteRows(input({ query: 'покинутость', guide: null }))).toEqual([]);
  });

  it('группы — по лучшему весу, при равенстве: клиенты, разделы, справочник, действия', () => {
    // «Клим» — начало имени; «клиенты», «клиента» — слово раздела и действия (равный вес); в листах — только в тексте
    expect(groups(buildPaletteRows(input({ query: 'кли' })))).toEqual([GROUP.clients, GROUP.sections, GROUP.actions, GROUP.guide]);
    // начало названия раздела «Справочник» весит больше, чем слово в середине
    const rows = buildPaletteRows(input({ query: 'с', clients: [client(9, 'Иван Сидоров')] }));
    expect(groups(rows).slice(0, 2)).toEqual([GROUP.sections, GROUP.clients]);
  });

  it('внутри группы — по убыванию веса; служебное слово «режим» находит действие', () => {
    const rows = buildPaletteRows(input({ query: 'все', clients: [client(1, 'Олег Всеволодов'), client(2, 'Всеслав')] }));
    expect(labels(rows.filter((r) => r.kind === 'client'))).toEqual(['Всеслав', 'Олег Всеволодов']);
    expect(labels(buildPaletteRows(input({ query: 'режим' })))).toContain('Переключиться в режим клиента');
  });

  it('клиент: быстрые действия по запросу — в одной группе «Действия»', () => {
    const rows = buildPaletteRows(input({ query: 'успокоиться', therapist: false, therapistMode: false, clients: [] }));
    expect(groups(rows)).toEqual([GROUP.actions]);
    expect(labels(rows)).toContain('Техника «Стоп»');
  });
});

describe('подсказки', () => {
  it('примеры — настоящие названия: первая схема, первый режим, первая техника; без текстов — пусто', () => {
    expect(paletteExamples(guide)).toEqual([SCHEMA, 'Уязвимый Ребёнок', FIXTURE_TECHNIQUES[0].name]);
    expect(paletteExamples(null)).toEqual([]);
  });

  it('что ищется — по роли, режиму и «Показу экрана»', () => {
    expect(paletteHelp({ therapist: true, therapistMode: true, screenShare: false })).toBe('Клиенты, листы справочника, разделы и действия');
    expect(paletteHelp({ therapist: true, therapistMode: true, screenShare: true })).toBe('Листы справочника, разделы и действия');
    expect(paletteHelp({ therapist: false, therapistMode: false, screenShare: false })).toBe('Разделы и действия');
  });
});
