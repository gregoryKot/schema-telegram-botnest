import { readFileSync } from 'fs';
import { join } from 'path';
import { CASE_NEED_ID_SET } from './case-steps.constants';

// shared/ — ESM, jest бэкенда его не грузит: сверяем с исходником NEED_ORDER текстом.
describe('CASE_NEED_ID_SET', () => {
  it('совпадает с NEED_ORDER сайта', () => {
    const src = readFileSync(join(__dirname, '../../shared/src/needs/types.ts'), 'utf8');
    const body = /NEED_ORDER[^=]*=\s*\[([^\]]*)\]/.exec(src)?.[1] ?? '';
    const ids = [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(ids.length).toBe(5);
    expect([...CASE_NEED_ID_SET].sort()).toEqual(ids.sort());
  });
});
