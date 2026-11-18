// Сборка строк общего поиска: группы и их порядок, лимит клиентов без запроса, листы справочника
// только в кабинете терапевта, клиенты скрыты при «Показе экрана».
import { describe, it, expect, vi } from 'vitest';
import type { TherapyClientSummary } from '../../api';
import type { CatalogTask } from '../../../../shared/src/tasks/catalog/taskCatalog';
import { buildReference, type ReferenceTexts } from '../../sections/guide/guideReferenceModel';
import { buildReferenceBody } from '../../sections/guide/guideReferenceBody';
import { getSchemaById } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import {
  FIXTURE_GUIDE, FIXTURE_PRACTICE_NOTE, FIXTURE_SCHEMA_GUIDE, FIXTURE_TECHNIQUES,
} from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';
import { CLIENTS_SHOWN } from './clientRows';
import { buildPaletteRows, searchPalette, GROUP, type PaletteInput } from './paletteRows';
import { paletteExamples, paletteHelp } from './paletteTexts';

const tr = (ty: string) => ty;
const texts: ReferenceTexts = {
  buildModeGuides: () => [{ ...FIXTURE_GUIDE, modeId: 'vulnerable_child', what: 'Ребёнок остаётся один на один с тоской.' }],
  buildSchemaDomainGuides: () => [{ domainId: 'rejection', note: 'домен', schemas: [{ ...FIXTURE_SCHEMA_GUIDE, schemaId: 'abandonment' }] }],
  buildTechniqueGuides: () => FIXTURE_TECHNIQUES,
  practiceNotes: () => [FIXTURE_PRACTICE_NOTE],
};
const TASKS: CatalogTask[] = [
  { id: 'pismo-kritiku', title: 'Письмо Критику', variants: [{ text: 'Написать письмо', forModes: [], forSchemas: [] }], why: '', group: 'modes' },
];
const guide = { ref: buildReference(texts, tr), body: buildReferenceBody(texts, tr), tasks: TASKS };
const SCHEMA = getSchemaById('abandonment')!.name;

const client = (telegramId: number, name: string): TherapyClientSummary => ({
  telegramId, name, clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null, recentIndexHistory: [],
  relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
});
const CLIENTS = ['Анна', 'Борис', 'Вера', 'Глеб', 'Дина', 'Ева', 'Клим'].map((n, i) => client(i + 1, n));

const run = () => ({ section: vi.fn(), path: vi.fn(), client: vi.fn(), toggleMode: vi.fn(), quick: vi.fn(), guideSheet: vi.fn(),
  pickAssignee: vi.fn(), assign: vi.fn(), addClient: vi.fn(), toggleScreenShare: vi.fn(),
});
const input = (over: Partial<PaletteInput>): PaletteInput => ({
  query: '', tr, therapist: true, therapistMode: true, screenShare: false, clients: CLIENTS, guide, recent: [], assign: null, run: run(), ...over,
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

  it('группы — по лучшему весу, при равенстве: клиенты, их вкладки, разделы, справочник, действия', () => {
    // «Клим» — начало имени, клиент один — следом его вкладки; «клиенты», «клиента» — слово раздела и действия (равный вес); в листах — только в тексте
    expect(groups(buildPaletteRows(input({ query: 'кли' })))).toEqual([GROUP.clients, GROUP.clientTabs, GROUP.sections, GROUP.actions, GROUP.guide]);
    // начало названия раздела «Справочник» весит больше, чем слово в середине
    const rows = buildPaletteRows(input({ query: 'с', clients: [client(9, 'Иван Сидоров')] }));
    expect(groups(rows).slice(0, 2)).toEqual([GROUP.sections, GROUP.clients]);
  });

  it('внутри группы — по убыванию веса; служебное слово «режим» находит действие', () => {
    const rows = buildPaletteRows(input({ query: 'все', clients: [client(1, 'Олег Всеволодов'), client(2, 'Всеслав')] }));
    expect(labels(rows.filter((r) => r.kind === 'client'))).toEqual(['Всеслав', 'Олег Всеволодов']);
    expect(labels(buildPaletteRows(input({ query: 'режим' })))).toContain('Переключиться в режим клиента');
  });

  it('родовое слово, которое движок справочника отбрасывает, находит листы по началу названия', () => {
    const rows = buildPaletteRows(input({ query: 'работа', clients: [] }));
    expect(rows.filter((r) => r.kind === 'guide')).toMatchObject([{ group: GROUP.guide, label: 'Работа со стульями', sub: expect.stringContaining('Техники') }]);
  });

  it('клиент: быстрые действия по запросу — в одной группе «Действия»', () => {
    const rows = buildPaletteRows(input({ query: 'успокоиться', therapist: false, therapistMode: false, clients: [] }));
    expect(groups(rows)).toEqual([GROUP.actions]);
    expect(labels(rows)).toContain('Техника «Стоп»');
  });
});

describe('опечатки и чужая раскладка', () => {
  it('опечатка в названии листа и в имени клиента находит строку; группа с опечаткой — после точных', () => {
    const [sheet] = buildPaletteRows(input({ query: 'уязвмый' }));
    expect(sheet).toMatchObject({ kind: 'guide', label: 'Уязвимый Ребёнок', sub: expect.stringContaining('Режимы') });
    const rows = buildPaletteRows(input({ query: 'Алексадр', clients: [client(1, 'Александр')] }));
    expect(labels(rows.filter((r) => r.kind === 'client'))).toEqual(['Александр']);
  });

  it('латиница без результатов — запрос в русской раскладке; строки и запрос — переведённые', () => {
    const found = searchPalette(input({ query: 'crkbv', clients: [client(1, 'Склим')] }));
    expect(found).toMatchObject({ query: 'склим', layoutFixed: true });
    expect(labels(found.rows.filter((r) => r.kind === 'client'))).toEqual(['Склим']);
  });

  it('перевод ничего не нашёл или запрос русский — запрос исходный', () => {
    expect(searchPalette(input({ query: 'qqqqzzz' }))).toEqual({ rows: [], query: 'qqqqzzz', layoutFixed: false });
    expect(searchPalette(input({ query: 'анна' }))).toMatchObject({ query: 'анна', layoutFixed: false });
    expect(searchPalette(input({ query: '' })).layoutFixed).toBe(false);
  });
});

describe('подсказки', () => {
  it('примеры — настоящие названия: первая схема, первый режим, первая техника; без текстов — пусто', () => {
    expect(paletteExamples(guide)).toEqual([SCHEMA, 'Уязвимый Ребёнок', FIXTURE_TECHNIQUES[0].name]);
    expect(paletteExamples(null)).toEqual([]);
  });

  it('что ищется — по роли, режиму и «Показу экрана»', () => {
    expect(paletteHelp({ therapist: true, therapistMode: true, screenShare: false })).toBe('Клиенты и их вкладки, задания, листы справочника, разделы и действия');
    expect(paletteHelp({ therapist: true, therapistMode: true, screenShare: true })).toBe('Листы справочника, разделы и действия');
    expect(paletteHelp({ therapist: false, therapistMode: false, screenShare: false })).toBe('Разделы и действия');
  });
});

describe('«Недавнее»', () => {
  const RECENT = ['client:7', 'guide:schema:abandonment', 'section:/cabinet/tasks', 'client:999', 'action:toggle-mode'];

  it('первая группа без запроса: строки по ключу среди всех доступных, порядок ключей; неразрешимый ключ пропущен', () => {
    const handlers = run();
    const rows = buildPaletteRows(input({ recent: RECENT, run: handlers }));
    expect(groups(rows)).toEqual([GROUP.recent, GROUP.clients, GROUP.sections, GROUP.actions]);
    const recent = rows.filter((r) => r.group === GROUP.recent);
    // «Клим» — седьмой клиент, вне первых пяти; лист справочника без запроса виден только здесь
    expect(labels(recent)).toEqual(['Клим', SCHEMA, 'Задания', 'Переключиться в режим клиента']);
    expect(recent.map((r) => r.kind)).toEqual(['client', 'guide', 'section', 'action']);
    expect(recent.some((r) => r.after)).toBe(false);
    recent[0].action();
    expect(handlers.client).toHaveBeenCalledWith(7);
  });

  it('«Показ экрана» прячет клиента; другой режим и незагруженный справочник — строки нет; пусто — группы нет', () => {
    expect(labels(buildPaletteRows(input({ recent: RECENT, screenShare: true })).filter((r) => r.group === GROUP.recent)))
      .toEqual([SCHEMA, 'Задания', 'Переключиться в режим клиента']);
    expect(labels(buildPaletteRows(input({ recent: RECENT, guide: null, therapistMode: false })).filter((r) => r.group === GROUP.recent)))
      .toEqual(['Клим', 'Переключиться в кабинет терапевта']);
    expect(groups(buildPaletteRows(input({ recent: ['client:999'] })))).not.toContain(GROUP.recent);
  });

  it('при запросе группы нет', () => {
    expect(groups(buildPaletteRows(input({ recent: RECENT, query: 'клим' })))).toEqual([GROUP.clients, GROUP.clientTabs]);
  });
});

describe('buildPaletteRows — кабинет: вкладки, задания, действия', () => {
  const keys = (rows: { key: string }[]) => rows.map((r) => r.key);
  const ACTIONS = ['action:assign-task', 'action:add-client', 'action:screen-share'];

  it('действия кабинета видны без запроса и находятся по запросу; клиенту их нет', () => {
    expect(keys(buildPaletteRows(input({})))).toEqual(expect.arrayContaining(ACTIONS));
    expect(labels(buildPaletteRows(input({ query: 'дать задание' })))[0]).toBe('Дать задание');
    expect(labels(buildPaletteRows(input({ query: 'добавить' })))).toContain('Добавить клиента');
    expect(labels(buildPaletteRows(input({ query: 'показ экрана' })))).toContain('Включить показ экрана');
    expect(labels(buildPaletteRows(input({ query: 'доска' })))).toContain('Задания');
    for (const mode of [{ therapist: false, therapistMode: false, clients: [] }, { therapistMode: false }]) {
      expect(keys(buildPaletteRows(input(mode))).filter((k) => ACTIONS.includes(k))).toEqual([]);
    }
  });

  it('«Показ экрана» включён: выключатель есть, «Дать задание» нет; без клиентов — только «Добавить клиента»', () => {
    const shared = buildPaletteRows(input({ screenShare: true }));
    expect(labels(shared)).toContain('Выключить показ экрана');
    expect(keys(shared)).not.toContain('action:assign-task');
    expect(keys(buildPaletteRows(input({ clients: [] }))).filter((k) => ACTIONS.includes(k))).toEqual(['action:add-client']);
  });

  it('«Дать задание» и строка каталога палитру не закрывают и ведут к выбору клиента', () => {
    const r = run();
    const rows = buildPaletteRows(input({ query: 'письмо', run: r }));
    const task = rows.find((row) => row.kind === 'task')!;
    expect(task).toMatchObject({ key: 'task:pismo-kritiku', group: GROUP.tasks, stay: true, sub: 'Дать клиенту · При режимах' });
    task.action();
    expect(r.pickAssignee).toHaveBeenCalledWith('pismo-kritiku');
    const action = buildPaletteRows(input({ run: r })).find((row) => row.key === 'action:assign-task')!;
    expect(action.stay).toBe(true);
    action.action();
    expect(r.pickAssignee).toHaveBeenLastCalledWith(null);
  });

  it('шаг «Кому дать задание?»: только клиенты, все без обрезки, не для «Недавнего»; запрос — по имени', () => {
    const r = run();
    const rows = buildPaletteRows(input({ assign: { catalogId: 'pismo-kritiku' }, recent: ['client:1'], run: r }));
    expect(groups(rows)).toEqual([GROUP.assign]);
    expect(rows).toHaveLength(CLIENTS.length);
    expect(rows.every((row) => row.transient && !row.after)).toBe(true);
    rows[1].action();
    expect(r.assign).toHaveBeenCalledWith(2, 'pismo-kritiku');
    expect(labels(buildPaletteRows(input({ assign: { catalogId: null }, query: 'вер' })))).toEqual(['Вера']);
  });

  it('«Недавнее» находит вкладку клиента и задание по ключу; при «Показе экрана» — нет', () => {
    const recent = ['client-tab:3:plan', 'task:pismo-kritiku'];
    const rows = buildPaletteRows(input({ recent })).filter((row) => row.group === GROUP.recent);
    expect(labels(rows)).toEqual(['Вера · План работы', 'Письмо Критику']);
    expect(buildPaletteRows(input({ recent, screenShare: true })).some((row) => row.group === GROUP.recent)).toBe(false);
  });

  it('вкладки единственного найденного клиента идут сразу за ним', () => {
    const rows = buildPaletteRows(input({ query: 'вера' }));
    expect(groups(rows).slice(0, 2)).toEqual([GROUP.clients, GROUP.clientTabs]);
  });
});
