// Сверка (№4): серверная копия id справочника = источники в shared/. Разъехались —
// сервер отвечает 400 на новый режим или схему либо пускает удалённый id.
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';
import { MODE_IDS, SCHEMA_IDS, isKbId } from './kb-ids';
import { NEED_IDS } from '../bot/bot.service';

// shared/ — ESM-пакет, jest бэкенда его не грузит: транспилируем и исполняем.
function load(path: string): Record<string, any> {
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} as Record<string, any> };
  const require = (rel: string) => load(join(dirname(path), `${rel}.ts`));
  runInNewContext(js, { module: mod, exports: mod.exports, require });
  return mod.exports;
}
const shared = join(__dirname, '../../shared/src');
const content = join(shared, 'schemaTherapy/content');

describe('kb-ids: копия id справочника', () => {
  it('схемы — как в schemaDomains.ts', () => {
    const domains = load(join(content, 'schemaDomains.ts')).SCHEMA_DOMAINS;
    const ids = domains.flatMap((d: any) => d.schemas.map((s: any) => s.id));
    expect([...SCHEMA_IDS]).toEqual(ids);
  });

  it('режимы — как в modeGroups*.ts', () => {
    const groups = load(join(content, 'modeGroups.ts')).MODE_GROUPS;
    const ids = groups.flatMap((g: any) => g.items.map((m: any) => m.id));
    expect([...MODE_IDS]).toEqual(ids);
  });

  it('потребности — как NEED_ORDER', () => {
    const order = load(join(shared, 'needs/types.ts')).NEED_ORDER;
    expect([...NEED_IDS]).toEqual([...order]);
  });

  it('свой режим терапевта проходит только как modeOrCustom', () => {
    expect(isKbId('modeOrCustom', 'cm_clx123abc')).toBe(true);
    expect(isKbId('mode', 'cm_clx123abc')).toBe(false);
    expect(isKbId('modeOrCustom', 'cm_')).toBe(false);
    expect(isKbId('modeOrCustom', 'no_such_mode')).toBe(false);
  });
});
