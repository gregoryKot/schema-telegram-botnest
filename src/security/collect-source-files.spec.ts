// Регрессия на issue #215 (вылезло в #214): рекурсивный обход src/ падал с
// ENOENT, споткнувшись о кэш jest (`src/.jest-cache/…`) — файлы исчезали под
// ногами обхода, пока параллельные воркеры чистили кэш, и джоба `backend`
// краснела мимо своей темы. Обход был скопирован в восьми местах, починен был
// один. Здесь фиксируем поведение единственного общего хелпера.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, sep } from 'path';
import {
  collectSourceFiles,
  CollectSourceFilesOptions,
} from './collect-source-files';

describe('collectSourceFiles', () => {
  let root: string;

  /** Создаёт файл вместе со всеми промежуточными каталогами. */
  const write = (relPath: string) => {
    const abs = join(root, ...relPath.split('/'));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, '// fixture\n');
  };

  /** Пути результата — относительно корня фикстуры, со слэшами. */
  const collect = (options?: CollectSourceFilesOptions) =>
    collectSourceFiles(root, options).map((p) =>
      relative(root, p).split(sep).join('/'),
    );

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'collect-source-files-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('пропускает скрытые каталоги (кэш jest — причина ENOENT из #215)', () => {
    write('app.service.ts');
    write('.jest-cache/haste-map-abc.ts');
    write('.jest-cache/nested/deep.ts');
    write('.stryker-tmp/sandbox-1/app.service.ts');

    expect(collect()).toEqual(['app.service.ts']);
  });

  it('пропускает скрытые файлы', () => {
    write('app.service.ts');
    write('.generated.ts');

    expect(collect()).toEqual(['app.service.ts']);
  });

  it('не берёт спеки, тесты и файлы деклараций', () => {
    write('app.service.ts');
    write('app.service.spec.ts');
    write('app.service.test.ts');
    write('express.d.ts');

    expect(collect()).toEqual(['app.service.ts']);
  });

  it('обходит вложенность на любую глубину', () => {
    write('top.ts');
    write('a/mid.ts');
    write('a/b/c/deep.ts');

    expect(collect()).toEqual(['a/b/c/deep.ts', 'a/mid.ts', 'top.ts']);
  });

  it('по умолчанию берёт только .ts, но расширения настраиваются', () => {
    write('logic.ts');
    write('View.tsx');
    write('styles.css');
    write('script.js');

    expect(collect()).toEqual(['logic.ts']);
    expect(collect({ extensions: ['.tsx'] })).toEqual(['View.tsx']);
    expect(collect({ extensions: ['.ts', '.tsx'] })).toEqual([
      'View.tsx',
      'logic.ts',
    ]);
  });

  it('спеки и тесты отбрасываются и для .tsx', () => {
    write('View.tsx');
    write('View.spec.tsx');
    write('View.test.tsx');

    expect(collect({ extensions: ['.ts', '.tsx'] })).toEqual(['View.tsx']);
  });

  it('фильтр по пути сужает выборку (напр. только контроллеры)', () => {
    write('api/health.controller.ts');
    write('api/health.service.ts');
    write('api/health.controller.spec.ts');

    expect(collect({ filter: (p) => p.endsWith('.controller.ts') })).toEqual([
      'api/health.controller.ts',
    ]);
  });

  it('*.e2e-spec.ts — не спек по этому правилу, его собирают явным фильтром', () => {
    // e2e-route-coverage.invariants.spec.ts читает test/*.e2e-spec.ts; такое
    // имя не матчится `.spec.ts`-исключением (перед `spec` дефис, не точка).
    write('app-auth.e2e-spec.ts');
    write('e2e-support/build-test-app.ts');

    expect(collect({ filter: (p) => p.endsWith('.e2e-spec.ts') })).toEqual([
      'app-auth.e2e-spec.ts',
    ]);
  });

  it('порядок стабильный, а не в порядке выдачи ФС', () => {
    write('z.ts');
    write('a.ts');
    write('m/z.ts');
    write('m/a.ts');

    expect(collect()).toEqual(['a.ts', 'm/a.ts', 'm/z.ts', 'z.ts']);
  });
});
