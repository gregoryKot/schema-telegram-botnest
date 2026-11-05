// Селектор scripts/mutation-changed-files.mjs: какие из изменённых файлов
// мутировать в PR-CI. Не гейт, но от него зависит, что PR-CI проверит.
import { runGate } from './gate-sandbox';

const config = JSON.stringify({ mutate: ['src/a.ts', 'src/b.ts'] });
const files = {
  'stryker.x.config.json': config,
  'src/a.ts': '',
  'src/b.ts': '',
};
const cfg = '--config=stryker.x.config.json';

describe('mutation-changed-files.mjs', () => {
  it('пересечение: только файлы из mutate', () => {
    const res = runGate('mutation-changed-files.mjs', files, {
      args: [cfg, 'src/b.ts', 'src/z.ts', 'README.md'],
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('src/b.ts');
  });

  it('несколько файлов — через запятую', () => {
    const res = runGate('mutation-changed-files.mjs', files, {
      args: [cfg, 'src/a.ts', 'src/b.ts'],
    });
    expect(res.stdout).toBe('src/a.ts,src/b.ts');
  });

  it('нет пересечения — пустой вывод (джоба зеленеет сразу)', () => {
    const res = runGate('mutation-changed-files.mjs', files, {
      args: [cfg, 'src/z.ts'],
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('удалённый файл (нет на диске) отбрасывается', () => {
    const res = runGate(
      'mutation-changed-files.mjs',
      { 'stryker.x.config.json': config, 'src/a.ts': '' },
      { args: [cfg, 'src/a.ts', 'src/b.ts'] },
    );
    expect(res.stdout).toBe('src/a.ts');
  });
});
