// Правило №4: названия потребностей бота и /stats совпадают с сайтом.
// shared/ — ESM, jest бэкенда его не грузит: транспилируем исходник и исполняем.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';
import { NEED_NAMES } from './need-names';

function loadSite(): Record<string, string> {
  const path = join(__dirname, '../../shared/src/needs/needNames.ts');
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} as { NEED_NAMES: Record<string, string> } };
  runInNewContext(js, {
    module: mod,
    exports: mod.exports,
    require: () => ({}),
  });
  return mod.exports.NEED_NAMES;
}

describe('need-names ↔ shared/src/needs/needNames.ts', () => {
  it('те же id в том же порядке и те же названия', () => {
    expect(Object.entries(NEED_NAMES)).toEqual(Object.entries(loadSite()));
  });
});
