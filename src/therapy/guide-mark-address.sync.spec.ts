// Правило №4: разбор адреса, реестр переименований и таблица смыслов на бэкенде —
// копия shared/src/schemaTherapy/guide/address/ (бэкенд не импортирует shared/).
// Спек транспилирует исходники сайта и сверяет поведение на образцах.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';
import {
  GUIDE_MARK_ADDRESS_RENAMES,
  GUIDE_MARK_ARTICLE_KINDS,
  GUIDE_MARK_FOREIGN_TARGETS,
  GUIDE_MARK_KINDS,
  isGuideMarkAddress,
  normalizeGuideAddress,
  parseGuideAddress,
} from './guide-mark-address';

const DIR = join(__dirname, '../../shared/src/schemaTherapy/guide/address');

type Exports = Record<string, any>;
const cache = new Map<string, Exports>();
function load(name: string): Exports {
  const hit = cache.get(name);
  if (hit) return hit;
  const src = readFileSync(join(DIR, `${name}.ts`), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} as Exports };
  const req = (p: string) => {
    if (!p.startsWith('./')) throw new Error(`внешний импорт ${p}`);
    return load(p.slice(2));
  };
  runInNewContext(js, { module: mod, exports: mod.exports, require: req });
  cache.set(name, mod.exports);
  return mod.exports;
}

const format = load('addressFormat');
const renames = load('addressRenames');
const targets = load('addressTargets');

const SAMPLES = [
  'schema:subjugation/coping.surrender',
  'schema:subjugation/coping.avoidance',
  'schema:subjugation/belief',
  'mode:vulnerable_child/experiential',
  'technique:chairwork/when',
  'note:first-session/body',
  'need:safety/text',
  'schema:subjugation/',
  'schema:/belief',
  'schema:sub jugation/belief',
  'mode:x/1abc',
  'mode:x/a..b',
  '',
];

describe('адрес справочника: бэкенд ↔ shared/guide/address', () => {
  it('виды статей совпадают', () => {
    expect([...GUIDE_MARK_ARTICLE_KINDS]).toEqual([
      ...format.GUIDE_ARTICLE_KINDS,
    ]);
  });

  it('реестр переименований совпадает', () => {
    expect(GUIDE_MARK_ADDRESS_RENAMES).toEqual(renames.GUIDE_ADDRESS_RENAMES);
  });

  it('таблица смыслов совпадает: всё не-guideMark перечислено', () => {
    const site = (
      targets.GUIDE_ADDRESS_TARGETS as { kind: string; pathPrefix: string }[]
    ).map(({ kind, pathPrefix }) => ({ kind, pathPrefix }));
    expect([...GUIDE_MARK_FOREIGN_TARGETS]).toEqual(site);
  });

  it.each(SAMPLES)('«%s»: разбор и куда ложится отметка', (address) => {
    const mine = parseGuideAddress(address);
    expect(mine).toEqual(format.parseAddress(address));
    if (mine)
      expect(isGuideMarkAddress(mine)).toBe(
        targets.addressTarget(address) === 'guideMark',
      );
  });

  it('нормализация совпадает, включая `*` и цепочки', () => {
    const table = {
      'mode:*/experiential': 'mode:*/feelings',
      'mode:*/feelings': 'mode:*/emotions',
      'technique:old/when': 'technique:new/when',
      'note:a/x': 'note:b/x',
      'note:b/x': 'note:a/x',
    };
    for (const a of [
      'mode:vulnerable_child/experiential',
      'technique:old/when',
      'note:a/x',
      'schema:abandonment/belief',
      'мусор',
    ])
      expect(normalizeGuideAddress(a, table)).toBe(
        renames.normalizeAddress(a, table),
      );
  });

  it('виды события guide_mark_added: бэкенд = тип GuideMarkKind сайта', () => {
    const src = readFileSync(
      join(__dirname, '../../shared/src/share/analyticsCabinetGuide.ts'),
      'utf8',
    );
    const union = /export type GuideMarkKind =([^;]+);/.exec(src)?.[1] ?? '';
    const site = [...union.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(site.sort()).toEqual([...GUIDE_MARK_KINDS].sort());
    expect(src).toContain("GUIDE_MARK_ADDED_EVENT = 'guide_mark_added'");
  });
});
