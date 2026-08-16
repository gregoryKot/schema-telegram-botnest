// Тест гейта check-second-person.mjs (свип 2026-08): обращение на «ты»/«вы»
// вне вилки tr()/t()/pickForm(). check-address-form.mjs уже ловит жёсткие
// «ты»-местоимения во фронтендах — этот гейт закрывает то, что он не видел:
// императивы без местоимения рядом, зеркальные «вы»-формы и бэкенд (`src/`),
// откуда шлются письма/уведомления (реальные баги аудита: /account, BottomSheet,
// InfoOverlay, письма).
//
// Проверяются оба исхода: гейт краснеет на регрессе И зеленеет на чистом
// дереве/на файле, где та же строка внутри вилки. Второй не менее важен —
// ложно-красный гейт отключают через неделю.
import { runGate } from './gate-sandbox';
import { loadNamedPatterns, loadRegexList } from './pattern-loader';

describe('check-second-person.mjs', () => {
  it('новый файл с захардкоженным «ты»-местоимением вне tr() — exit 1', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'webapp/src/pages/Foo.tsx':
        "export const msg = 'Привет, ты справишься!';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'webapp/src/pages/Foo.tsx: новый файл с 1 вхождениями',
    );
    expect(res.stderr).toContain('[pronoun-ty] ты');
  });

  it('ловит захардкоженный императив без единого местоимения рядом', () => {
    // Ровно так был найден баг: BottomSheet мини-аппа звал «Нажми» безусловно.
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'schema-miniapp/src/components/BottomSheet.tsx':
        "export const hint = 'Нажми кнопку ниже, чтобы продолжить';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[imperative-ty] Нажми');
  });

  it('ловит захардкоженную «вы»-форму — зеркальный баг тоже считается', () => {
    // «ты»-пользователь не должен увидеть «вы» в интерфейсе так же, как
    // «вы»-пользователь не должен увидеть «ты» — оба вне tr() являются багом.
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'webapp/src/pages/account/InfoOverlay.tsx':
        "export const msg = 'Введите код из письма, который мы вам отправили';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[imperative-vy] Введите');
    expect(res.stderr).toContain('[pronoun-vy] вам');
  });

  it('бэкенд (src/, письма/уведомления) тоже сканируется', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/notification/foo.templates.ts':
        "export const subject = 'Заполни дневник сегодня — это займёт минуту';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/notification/foo.templates.ts');
    expect(res.stderr).toContain('[imperative-ty] Заполни');
  });

  it('«ты» внутри вилки tr(...) — легитимно, exit 0', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'schema-miniapp/src/components/BottomSheet.tsx':
        "const msg = tr('Нажми кнопку, ты справишься', 'Нажмите кнопку, вы справитесь');\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('та же строка внутри t(form, …)/pickForm(form, …) — тоже легитимно, exit 0', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/notification/foo.templates.ts': [
        "const a = t(form, 'Заполни дневник сегодня', 'Заполните дневник сегодня');",
        "const b = pickForm(form, 'Нажми, чтобы продолжить', 'Нажмите, чтобы продолжить');",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('многострочный tr(...) — легитимно (prettier переносит аргументы), exit 0', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'webapp/src/pages/account/InfoOverlay.tsx': [
        'const msg = tr(',
        "  'Нажми кнопку, ты справишься',",
        "  'Нажмите кнопку, вы справитесь',",
        ');',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('дословная цитата в «…» сохраняет регистр — не считается', () => {
    // Правило CLAUDE.md: реплики Критика/внутренняя речь в «…» не обязаны
    // идти через tr(), это межличностная речь, а не UI-текст.
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/bot/quotes.ts':
        "export const msg = 'Критик говорит: «ты опять всё испортил»';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('маркетинговый лендинг исключён из сканирования', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'webapp/src/pages/LandingPage.tsx':
        "export const msg = 'Нажми кнопку и попробуй бесплатно';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('.spec./.test. файлы не сканируются (фикстуры гейта — не user-facing)', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/foo.spec.ts': "export const msg = 'Нажми кнопку, ты справишься';\n",
      'webapp/src/foo.test.tsx':
        "export const msg = 'Нажми кнопку, ты справишься';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('рост счётчика в известном файле — exit 1 с «было → стало»', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({
        'src/known.ts': 1,
      }),
      'src/known.ts': [
        "const a = 'Заполни дневник';",
        "const b = 'Проверь свои записи';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/known.ts: 1 → 2');
  });

  it('снижение счётчика — exit 0, предлагает зафиксировать --update', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({
        'src/known.ts': 2,
      }),
      'src/known.ts': "const a = 'Заполни дневник';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 < 2 — стало лучше');
  });

  it('нет бейслайна — понятная ошибка, exit 1', () => {
    const res = runGate('check-second-person.mjs', {
      'src/foo.ts': "export const msg = 'Заполни дневник';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('--update');
  });
});

// Механизм вместо добросовестности (как ALLOW в check-gendered-forms.mjs):
// у КАЖДОГО паттерна — живой образец, который ловит именно он, и у КАЖДОГО
// исключения EXCLUDE — образец из корпуса, который оно распознаёт.
describe('каждый паттерн и EXCLUDE-исключение пойманы своим образцом', () => {
  const PATTERNS = loadNamedPatterns('check-second-person.mjs', 'PATTERNS');
  const EXCLUDE = loadRegexList('check-second-person.mjs', 'EXCLUDE');

  const POSITIVE: Record<string, string> = {
    'pronoun-ty': 'Привет, ты справишься',
    'pronoun-vy': 'Привет, вы справитесь',
    'imperative-ty': 'Нажми кнопку ниже',
    'imperative-vy': 'Нажмите кнопку ниже',
  };

  it('в PATTERNS нет имени без образца в POSITIVE', () => {
    const missing = PATTERNS.map((p) => p.name).filter((n) => !(n in POSITIVE));
    expect(missing).toEqual([]);
  });

  it.each(PATTERNS.map((p) => [p.name] as const))(
    'паттерн «%s» ловит свой образец',
    (name) => {
      const p = PATTERNS.find((x) => x.name === name)!;
      const re = new RegExp(p.source, p.flags);
      expect(re.test(POSITIVE[name])).toBe(true);
    },
  );

  // Реflexivные императивы («-ся/-сь») меняют окончание на «-тесь», а не
  // просто дописывают «те» — отдельная проверка, что vyForm() посчитала верно.
  it.each([
    ['Поделись', 'Поделитесь'],
    ['Признайся', 'Признайтесь'],
    ['Доверься', 'Доверьтесь'],
    ['Откажись', 'Откажитесь'],
  ] as const)('возвратный императив «%s» → «%s» в вы-форме', (ty, vy) => {
    const p = PATTERNS.find((x) => x.name === 'imperative-vy')!;
    const re = new RegExp(p.source, p.flags);
    expect(re.test(vy)).toBe(true);
    // и обратное: ty-форма НЕ ловится паттерном imperative-vy
    expect(re.test(ty)).toBe(false);
  });

  it('у каждого исключения EXCLUDE есть образец, который оно распознаёт', () => {
    const CORPUS = [
      'webapp/src/pages/LandingPage.tsx',
      'webapp/src/pages/ProductLandingPage.tsx',
      'webapp/src/pages/ArticlesPage.tsx',
      'webapp/src/pages/GamePage.tsx',
      'webapp/src/pages/ReviewsPage.tsx',
      'webapp/src/pages/articleDiagrams.ts',
    ];
    const unmatched = EXCLUDE.filter(
      (p) => !CORPUS.some((text) => new RegExp(p.source, p.flags).test(text)),
    );
    expect(unmatched).toEqual([]);
  });
});
