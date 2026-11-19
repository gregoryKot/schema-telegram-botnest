// Строки общего поиска в режиме клиента: схемы и режимы, упражнения, свои планы и задания —
// поиск по названию, лимит группы, условия показа, «Недавнее» и обзор без запроса.
import { describe, it, expect, vi } from 'vitest';
import type { PracticePlan, UserTask } from '../../api';
import { EXERCISES } from '../../../../shared/src/exercises/exerciseCatalog';
import { buildPlusActions } from '../../../../shared/src/quickActions/quickActions';
import { ALL_MODES, ALL_SCHEMAS } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import { CLIENT_GROUP_SHOWN, allClientModeRows, clientModeRows } from './clientModeRows';
import { OWN_TASKS_PREVIEW } from './ownRows';
import { buildPaletteRows, GROUP, type PaletteInput } from './paletteRows';

const tr = (ty: string) => ty;
const task = (id: number, text: string, over: Partial<UserTask> = {}): UserTask => ({
  id, userId: 1, assignedBy: null, type: 'custom', text, targetDays: null, needId: null, dueDate: null,
  done: null, completedAt: null, createdAt: '2026-11-01', ...over,
} as UserTask);
const plan = (id: number, practiceText: string, scheduledDate: string, done: boolean | null = null): PracticePlan =>
  ({ id, needId: 'attachment', practiceText, scheduledDate, reminderUtcHour: null, done });
const run = () => ({ section: vi.fn(), pattern: vi.fn(), practice: vi.fn(), ownTask: vi.fn(), quick: vi.fn(), toggleMode: vi.fn() });
const input = (over: object = {}) => ({
  query: '', tr, therapist: false, therapistMode: false, screenShare: false, clients: [], guide: null,
  own: { tasks: [], plans: [] }, articles: [], recent: [], assign: null, run: run(), ...over,
}) as unknown as PaletteInput;
const groups = (rows: { group: string }[]) => [...new Set(rows.map((r) => r.group))];
const SCHEMA = ALL_SCHEMAS[0];
const MODE = ALL_MODES[0];

describe('схемы, режимы и упражнения', () => {
  it('схема по названию: ключ, вид, домен в подзаголовке; действие — переход к паттерну', () => {
    const handlers = run();
    const rows = buildPaletteRows(input({ query: SCHEMA.name, run: handlers }));
    expect(rows[0]).toMatchObject({ key: `pattern:schema:${SCHEMA.id}`, kind: 'pattern', group: GROUP.schemas, label: SCHEMA.name });
    expect(rows[0].sub).toBeTruthy();
    rows[0].action();
    expect(handlers.pattern).toHaveBeenCalledWith({ kind: 'schema', id: SCHEMA.id });
  });

  it('режим и упражнение: свои ключи и действия; описание упражнения в поиск не входит', () => {
    const handlers = run();
    const over = { run: handlers };
    const [mode] = buildPaletteRows(input({ ...over, query: MODE.name })).filter((r) => r.group === GROUP.modes);
    expect(mode).toMatchObject({ key: `pattern:mode:${MODE.id}`, kind: 'pattern', sub: MODE.groupName });
    const [ex] = buildPaletteRows(input({ ...over, query: 'безопасное место' }));
    expect(ex).toMatchObject({ key: 'exercise:safe', kind: 'exercise', group: GROUP.exercises });
    ex.action();
    expect(handlers.practice).toHaveBeenCalledWith({ kind: 'exercise', id: 'safe' });
    expect(clientModeRows(input({ query: 'мысленно возвращаться' }))).toEqual([]);
  });

  it('группа по запросу — не больше лимита; упражнения не повторяют подписи действий «+»', () => {
    const modes = clientModeRows(input({ query: 'ребёнок' })).filter((r) => r.row.group === GROUP.modes);
    expect(modes).toHaveLength(CLIENT_GROUP_SHOWN);
    const plus = buildPlusActions(tr).flatMap((g) => g.actions.map((a) => a.label));
    expect(EXERCISES.filter((e) => plus.includes(e.title))).toEqual([]);
  });

  it('в кабинете терапевта клиентских групп нет — ни по запросу, ни в «Недавнем»', () => {
    const cabinet = { therapist: true, therapistMode: true, recent: [`pattern:schema:${SCHEMA.id}`] };
    expect(buildPaletteRows(input({ ...cabinet, query: SCHEMA.name })).some((r) => r.kind === 'pattern')).toBe(false);
    expect(groups(buildPaletteRows(input(cabinet)))).not.toContain(GROUP.recent);
  });
});

describe('свои задания и планы', () => {
  const tasks = [
    task(1, 'Позвонить маме'), task(2, 'Позвонить врачу', { done: true }), task(3, 'vulnerable_child', { type: 'mode_intro', assignedBy: 7, dueDate: '2026-12-01' }),
    task(4, 'Прогулка'), task(5, 'Письмо'),
  ];
  const plans = [plan(1, 'Позвать друга на чай', '2026-11-10', true), plan(2, 'Позвать сестру в кино', '2026-11-12'), ...Array.from({ length: 7 }, (_, i) => plan(10 + i, `Лечь до полуночи ${i}`, `2026-11-0${i + 1}`))];
  const own = { tasks, plans };

  it('задание ищется по названию списка заданий; выполненных нет; действие — открыть задание', () => {
    const handlers = run();
    const rows = buildPaletteRows(input({ query: 'позвонить', own, run: handlers }));
    expect(rows).toMatchObject([{ key: 'own_task:1', kind: 'own_task', group: GROUP.ownTasks, label: 'Позвонить маме', sub: 'Своя цель' }]);
    rows[0].action();
    expect(handlers.ownTask).toHaveBeenCalledWith(1);
    const [card] = clientModeRows(input({ query: 'уязвимый', own })).filter((r) => r.row.kind === 'own_task');
    expect(card.row).toMatchObject({ label: 'Карточка режима: Уязвимый Ребёнок', sub: expect.stringMatching(/^От терапевта · до /) });
  });

  it('без запроса — первые активные задания сразу после «Недавнего» и «Ещё N» в обеих формах', () => {
    const rows = buildPaletteRows(input({ own, recent: ['plan:2', 'own_task:5', 'exercise:warm'] }));
    expect(groups(rows).slice(0, 3)).toEqual([GROUP.recent, GROUP.ownTasks, GROUP.sections]);
    expect(rows.filter((r) => r.group === GROUP.recent).map((r) => r.key)).toEqual(['plan:2', 'own_task:5', 'exercise:warm']);
    const preview = rows.filter((r) => r.group === GROUP.ownTasks);
    expect(preview).toHaveLength(OWN_TASKS_PREVIEW);
    expect(preview[OWN_TASKS_PREVIEW - 1].after).toBe('Ещё 1 — начни вводить название');
    const vy = buildPaletteRows(input({ own, tr: (_ty: string, v: string) => v }));
    expect(vy.find((r) => r.after)?.after).toBe('Ещё 1 — начните вводить название');
    expect(groups(rows)).not.toContain(GROUP.plans);
  });

  it('план: по запросу, свежие первыми, «выполнен» в подзаголовке, лимит; действие — «Мои планы»', () => {
    const handlers = run();
    const rows = buildPaletteRows(input({ query: 'позвать', own, run: handlers }));
    expect(rows.map((r) => r.key)).toEqual(['plan:2', 'plan:1']);
    expect(rows[1]).toMatchObject({ kind: 'plan', group: GROUP.plans, label: 'Позвать друга на чай', sub: expect.stringMatching(/ · выполнен$/) });
    rows[0].action();
    expect(handlers.practice).toHaveBeenCalledWith({ kind: 'plans' });
    expect(buildPaletteRows(input({ query: 'лечь', own }))).toHaveLength(CLIENT_GROUP_SHOWN);
  });

  it('нет заданий и планов — групп нет; ключи строк — тип и id, без текста', () => {
    expect(groups(buildPaletteRows(input()))).not.toContain(GROUP.ownTasks);
    expect(clientModeRows(input({ query: 'позвать' }))).toEqual([]);
    for (const row of allClientModeRows(input({ own }))) expect(row.key).toMatch(/^(pattern:(schema|mode)|exercise|plan|own_task):[\w-]+$/);
  });
});
