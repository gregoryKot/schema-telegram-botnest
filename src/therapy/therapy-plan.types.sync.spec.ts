// Сверка (правило №4): рубрики и статусы пункта плана на бэкенде (therapy-plan.types.ts — их проверяет DTO)
// и на фронте (shared/src/therapy/plan/planItem.ts — по ним вкладка «План работы» группирует пункты и
// переключает статус). Бэкенд shared не импортирует, поэтому списки читаются из файла.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PLAN_RUBRICS,
  PLAN_SOURCE_KINDS,
  PLAN_STATUSES,
} from './therapy-plan.types';

const src = readFileSync(
  join(
    __dirname,
    '..',
    '..',
    'shared',
    'src',
    'therapy',
    'plan',
    'planItem.ts',
  ),
  'utf8',
);
const quoted = (block: string | undefined) =>
  [...(block ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const list = (name: string) =>
  quoted(
    src.match(
      new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`),
    )?.[1],
  );

describe('план работы — бэкенд и фронт знают одни рубрики и статусы', () => {
  it('PLAN_RUBRICS — тот же список в том же порядке', () => {
    expect(list('PLAN_RUBRICS')).toEqual([...PLAN_RUBRICS]);
  });

  it('PLAN_STATUSES — тот же цикл статусов', () => {
    expect(list('PLAN_STATUSES')).toEqual([...PLAN_STATUSES]);
  });

  it('виды статьи-источника в PlanSource — те же', () => {
    expect(quoted(src.match(/kind: ([^;]+);/)?.[1])).toEqual([
      ...PLAN_SOURCE_KINDS,
    ]);
  });
});

// Старый источник → адрес: SQL миграции повторяет legacyPlanSourceAddress (planAddress.ts).
describe('план работы — перевод старого источника в адрес: миграция = сайт', () => {
  const root = join(__dirname, '..', '..');
  const sql = readFileSync(
    join(
      root,
      'prisma/migrations/20261120160000_plan_source_address/migration.sql',
    ),
    'utf8',
  );
  const site = readFileSync(
    join(root, 'shared/src/therapy/plan/planAddress.ts'),
    'utf8',
  ).replace(/\s+/g, ' ');

  it('адрес — `вид:id/поле`, как formatAddress', () => {
    expect(sql).toContain(
      `"sourceKind" || ':' || "sourceId" || '/' || "sourceField"`,
    );
    expect(site).toContain(
      'formatAddress({ kind: source.kind, articleId: source.id, path: source.field, })',
    );
  });

  it('переводятся те же виды статей', () => {
    const inSql = quoted(/"sourceKind" IN \(([^)]+)\)/.exec(sql)?.[1]);
    const inSite = quoted(
      /OLD_KINDS[^=]*= new Set\(\[([^\]]+)\]/.exec(site)?.[1],
    );
    expect(inSql).toEqual(inSite);
    expect(inSql).toEqual([...PLAN_SOURCE_KINDS]);
  });
});
