// Тест гейта check-address-form.mjs — храповик жёстких «ты»-форм без tr()
// (правило CLAUDE.md «Обращение ты/вы»): «ты»-строка вне вилки tr(...)
// означает, что пользователь с формой «вы» увидит «ты» в интерфейсе.
import { runGate } from './gate-sandbox';
import { loadRegexList } from './pattern-loader';

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

  // TY_RE ловит несколько форм в одной альтернации — «Ты»/«твой» уже пиненные
  // выше тестами, «тебя»/«тебе»/«тобой» не были покрыты ни одним тестом
  // (замер: убрать их из альтернации ни один тест не ловил).
  it('«тебя»/«тебе»/«тобой» вне tr() — тоже считаются, exit 1', () => {
    const res = runGate('check-address-form.mjs', {
      ...SCAN_DIR_STUBS,
      'scripts/address-form-baseline.json': JSON.stringify({}),
      'webapp/src/pages/Foo.tsx': [
        "const a = 'Это для тебя';",
        "const b = 'Расскажу тебе';",
        "const c = 'Мы гордимся тобой';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/pages/Foo.tsx: 0 → 3');
  });

  // FORK_OPEN_RE распознаёт три вилки — tr()/pickForm()/t(). Тест выше ловит
  // только tr(); pickForm()/t() не были покрыты ни одним тестом (замер: сузить
  // альтернацию до одного tr ни один тест не ловил).
  it('«ты» внутри вилки pickForm(...)/t(...) — тоже легитимно, exit 0', () => {
    const res = runGate('check-address-form.mjs', {
      ...SCAN_DIR_STUBS,
      'scripts/address-form-baseline.json': JSON.stringify({}),
      'webapp/src/pages/Foo.tsx': [
        "const a = pickForm(form, 'Привет, ты справишься', 'Привет, вы справитесь');",
        "const b = t('Привет, ты справишься', 'Привет, вы справитесь');",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ ты/вы-храповик: без регрессий');
  });

  // Ни LandingPage/ArticlesPage/GamePage/…, ни .test.tsx, ни .d.ts не были
  // покрыты ни одним тестом — весь EXCLUDE-список можно было опустошить
  // бесследно (замер подтверждён мутацией скрипта).
  it('лендинг (webapp/src/pages/LandingPage) исключён из сканирования', () => {
    const res = runGate('check-address-form.mjs', {
      ...SCAN_DIR_STUBS,
      'scripts/address-form-baseline.json': JSON.stringify({}),
      'webapp/src/pages/LandingPage.tsx':
        "export const msg = 'Привет, ты справишься!';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ ты/вы-храповик: без регрессий');
  });

  it('.d.ts исключён из сканирования', () => {
    const res = runGate('check-address-form.mjs', {
      ...SCAN_DIR_STUBS,
      'scripts/address-form-baseline.json': JSON.stringify({}),
      'webapp/src/globals.d.ts':
        "declare const MSG: 'Привет, ты справишься!';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ ты/вы-храповик: без регрессий');
  });
});

// Механизм вместо добросовестности (как ALLOW в check-gendered-forms.mjs):
// у КАЖДОГО исключения EXCLUDE обязан быть образец, который оно распознаёт.
describe('каждое исключение EXCLUDE распознаёт свой образец', () => {
  const EXCLUDE = loadRegexList('check-address-form.mjs', 'EXCLUDE');

  const CORPUS = [
    'webapp/src/pages/LandingPage.tsx',
    'webapp/src/pages/ProductLandingPage.tsx',
    'webapp/src/pages/ArticlesPage.tsx',
    'webapp/src/pages/GamePage.tsx',
    'webapp/src/pages/ReviewsPage.tsx',
    'webapp/src/pages/articleDiagrams.ts',
    'webapp/src/foo.test.tsx',
    'webapp/src/globals.d.ts',
  ];

  it('у каждого исключения есть образец, который оно распознаёт', () => {
    const unmatched = EXCLUDE.filter(
      (p) => !CORPUS.some((text) => new RegExp(p.source, p.flags).test(text)),
    );
    expect(unmatched).toEqual([]);
  });
});
