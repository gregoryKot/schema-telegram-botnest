// Тест гейта check-address-form.mjs — храповик жёстких «ты»-форм без tr()
// (правило CLAUDE.md «Обращение ты/вы»): «ты»-строка вне вилки tr(...)
// означает, что пользователь с формой «вы» увидит «ты» в интерфейсе.
import { runGate } from './gate-sandbox';

// Скрипт (walk()) падает с ENOENT, если директории из SCAN_DIRS нет вообще
// (в отличие от check-legacy-name.mjs, здесь нет try/catch) — поэтому все
// три дерева должны физически существовать в песочнице в каждом тесте,
// даже когда фикстура интересуется только одним из них.
const SCAN_DIR_STUBS = {
  'webapp/src/.keep.ts': '',
  'schema-miniapp/src/.keep.ts': '',
  'shared/src/.keep.ts': '',
};

describe('check-address-form.mjs', () => {
  it('новая жёсткая «ты»-форма без tr() — рост счётчика, exit 1', () => {
    const res = runGate('check-address-form.mjs', {
      ...SCAN_DIR_STUBS,
      'scripts/address-form-baseline.json': JSON.stringify({}),
      'webapp/src/pages/Foo.tsx':
        "export const msg = 'Привет, ты справишься!';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/pages/Foo.tsx: 0 → 1');
  });

  it('рост числа вхождений в уже известном файле — exit 1', () => {
    const res = runGate('check-address-form.mjs', {
      ...SCAN_DIR_STUBS,
      'scripts/address-form-baseline.json': JSON.stringify({
        'webapp/src/pages/Foo.tsx': 1,
      }),
      'webapp/src/pages/Foo.tsx': [
        "const a = 'Привет, ты справишься!';",
        "const b = 'Загляни в твой дневник';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/pages/Foo.tsx: 1 → 2');
  });

  it('«ты» внутри вилки tr(...) — легитимно, не считается, exit 0', () => {
    const res = runGate('check-address-form.mjs', {
      ...SCAN_DIR_STUBS,
      'scripts/address-form-baseline.json': JSON.stringify({}),
      'schema-miniapp/src/pages/Foo.tsx':
        "const msg = tr('Привет, ты справишься', 'Привет, вы справитесь');\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ ты/вы-храповик: без регрессий');
  });
});
