// Тест гейта check-e2e-stop-cron.mjs — «тест, поднявший AppModule, гасит его
// настоящие @Cron» (инцидент CI PR #722: тик sendReminders посреди спека,
// шпион видел 4 DM вместо 1).
//
// Оба исхода плюс контрольные образцы (правило №15): вызов в комментарии не
// считается, вызов до init не считается, боевой src/main.ts не проверяется,
// пустой набор — красный (гейт, который ничего не нашёл, смотрит не туда).
import { runGate } from './gate-sandbox';

const BUILDER = [
  "import { AppModule } from '../../src/app.module';",
  "import { stopCronJobs } from './stop-cron-jobs';",
  'export async function build() {',
  '  const app = await create(AppModule);',
  '  await app.init();',
  '  await stopCronJobs(app);',
  '  return app;',
  '}',
].join('\n');

const gate = (files: Record<string, string>) =>
  runGate('check-e2e-stop-cron.mjs', files);

describe('check-e2e-stop-cron.mjs', () => {
  it('чистое дерево: строитель гасит кроны, спеки через него не проверяются', () => {
    const res = gate({
      'test/e2e-support/build-test-app.ts': BUILDER,
      'test/a.e2e-spec.ts':
        "import { buildTestApp } from './e2e-support/build-test-app';\n",
      // Боевой бутстрап поднимает AppModule законно и в выборку не входит.
      'src/main.ts':
        "import { AppModule } from './app.module';\nawait app.init();\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('test/e2e-support/build-test-app.ts');
    expect(res.stdout).not.toContain('src/main.ts');
  });

  it('спек собрал AppModule сам и не погасил кроны — красный, файл назван', () => {
    const res = gate({
      'test/e2e-support/build-test-app.ts': BUILDER,
      'test/own.e2e-spec.ts':
        "import { AppModule } from '../src/app.module';\nconst app = make(AppModule);\nawait app.init();\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'test/own.e2e-spec.ts: поднимает AppModule без stopCronJobs',
    );
    expect(res.stderr).not.toContain('build-test-app.ts');
  });

  it('src/**/*.spec.ts и динамический import тоже считаются', () => {
    const res = gate({
      'test/e2e-support/build-test-app.ts': BUILDER,
      'src/x/boot.spec.ts':
        "const { AppModule } = await import('../app.module');\nawait app.init();\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/x/boot.spec.ts');
  });

  it('контрольный: stopCronJobs в комментарии не считается', () => {
    const res = gate({
      'test/e2e-support/build-test-app.ts': BUILDER.replace(
        '  await stopCronJobs(app);',
        '  // await stopCronJobs(app);',
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('без stopCronJobs');
  });

  it('контрольный: stopCronJobs до app.init() — красный', () => {
    const res = gate({
      'test/e2e-support/build-test-app.ts': BUILDER.replace(
        '  await app.init();\n  await stopCronJobs(app);',
        '  await stopCronJobs(app);\n  await app.init();',
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('раньше app.init()');
  });

  it('контрольный: app.module только в комментарии — файл AppModule не поднимает', () => {
    const res = gate({
      'test/e2e-support/build-test-app.ts': BUILDER,
      'test/note.e2e-spec.ts':
        "// как в '../src/app.module', но без него\nawait app.init();\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain('note.e2e-spec.ts');
  });

  // Образец: тест гейта держит импорт строкой-фикстурой (как этот файл) —
  // это не импорт. Контрольный образец того же импорта кодом — тест «спек
  // собрал AppModule сам» выше.
  it('строка с импортом app.module внутри кавычек — не импорт', () => {
    const res = gate({
      'test/e2e-support/build-test-app.ts': BUILDER,
      'src/test-support/gates/x.spec.ts': [
        'const files = {',
        "  'a.ts': \"import { AppModule } from '../src/app.module';\",",
        "  'b.ts': \"const m = await import('../app.module');\",",
        '};',
        'await app.init();',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain('x.spec.ts');
  });

  it('ни один файл не поднимает AppModule — красный: гейт смотрит не туда', () => {
    const res = gate({ 'test/a.e2e-spec.ts': '// пусто\n' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('смотрит не туда');
  });
});
