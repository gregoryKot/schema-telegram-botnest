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
//
// Калибровка 2026-08 (второй свип, координатор): бейслайн упал с 359 до 65
// вхождений — правила и разбор каждой зоны/конструкции вынесены в
// second-person-patterns.mjs. Ниже — тесты на оба новых поведения (зона вне
// addressForm, таблица пар ty/вы) ПЛЮС контрольные случаи на ту же
// формулировку в обычном компоненте — без контроля тест не доказывает, что
// послабление узкое, а не дыра.
import { runGate } from './gate-sandbox';
import { loadNamedPatterns, loadRegexList, callExport } from './pattern-loader';

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

  // ── Калибровка 2026-08: зоны вне addressForm ──────────────────────────
  it('статьи сайта (единая форма «вы», не привязаны к addressForm) исключены', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/articles/articles.seed.ts':
        "export const ARTICLE_SEED = [{ content: 'Вы можете заметить этот паттерн у себя' }];\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('владелец-only диагностика площадки канала (explain()) исключена', () => {
    // src/channel/targets/*.target.ts — подсказку читает только владелец в
    // логах/админке при сбое публикации поста, не подписчик канала.
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/channel/targets/vk.target.ts':
        "export function explain() { return 'Проверь ключ доступа сообщества'; }\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('КОНТРОЛЬ: тот же императив в обычном компоненте — по-прежнему exit 1', () => {
    // Доказывает, что exclude узкий (по конкретным путям), а не случайно
    // погасил паттерн imperative-ty целиком.
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'webapp/src/components/SomeSheet.tsx':
        "export const msg = 'Нажми кнопку и попробуй бесплатно';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[imperative-ty] Нажми');
  });

  it('КОНТРОЛЬ: страница вне exclude-списка, похожая по смыслу на исключённые — exit 1', () => {
    // LinkDevicePage.tsx проверен вручную и НАМЕРЕННО не в EXCLUDE (реальный
    // долг: требует authenticated, форма там доступна) — фиксируем тестом,
    // чтобы его нельзя было тихо занести в исключения без замеченного диффа.
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'webapp/src/pages/LinkDevicePage.tsx':
        "export const msg = 'Проверьте, что код запросили вы сами';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[imperative-vy] Проверьте');
  });

  // ── Калибровка 2026-08: таблицы пар [ты-текст, вы-текст] ──────────────
  it('таблица пар Array<[string, string]> — легитимна, exit 0', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/notification/foo.templates.ts': [
        'const INTROS: Array<[string, string]> = [',
        '  [',
        "    'Как ты сегодня, по-честному?',",
        "    'Как вы сегодня, по-честному?',",
        '  ],',
        '];',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('объектная пара { ty: …, vy: … } — легитимна, exit 0', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'shared/src/components/FooNote.tsx': [
        'const TEXTS = {',
        '  variant: {',
        "    ty: 'Попробуй ещё раз, чтобы не потерять прогресс.',",
        "    vy: 'Попробуйте ещё раз, чтобы не потерять прогресс.',",
        '  },',
        '};',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('КОНТРОЛЬ: та же пара строк вне Array<[string, string]>/ty-vy-объекта — exit 1', () => {
    // Доказывает, что бланкер реагирует на структуру (типизацию/ключи), а не
    // просто на вид «два соседних литерала».
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/notification/foo.templates.ts': [
        'const INTROS = [',
        '  [',
        "    'Как ты сегодня, по-честному?',",
        "    'Как вы сегодня, по-честному?',",
        '  ],',
        '];',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[pronoun-ty] ты');
    expect(res.stderr).toContain('[pronoun-vy] вы');
  });

  // ── Калибровка 2026-08: владелец-only алерты (alertAdmin/…) ───────────
  it('строка внутри this.notify.alertAdmin(...) — легитимна, exit 0', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/booking/foo.service.ts':
        "await this.notify.alertAdmin('Сумма расходится — проверьте вручную в админке.');\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ Обращение вне механики форм: 0 (без роста)',
    );
  });

  it('КОНТРОЛЬ: та же строка в обычном вызове (не алерт админу) — exit 1', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'src/booking/foo.service.ts':
        "await this.notify.sendClientMessage('Сумма расходится — проверьте вручную в админке.');\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[imperative-vy] проверьте');
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
  const PATTERNS = loadNamedPatterns('second-person-patterns.mjs', 'PATTERNS');
  const EXCLUDE = loadRegexList('second-person-patterns.mjs', 'EXCLUDE');

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
      // Маркетинг сайта.
      'webapp/src/pages/LandingPage.tsx',
      'webapp/src/pages/ProductLandingPage.tsx',
      'webapp/src/pages/ArticlesPage.tsx',
      'webapp/src/pages/GamePage.tsx',
      'webapp/src/pages/ReviewsPage.tsx',
      'webapp/src/pages/articleDiagrams.ts',
      // Публичный лендинг психолога / виджет записи до входа.
      'webapp/src/pages/landing/BookingForm.tsx',
      'webapp/src/components/BookingPicker.tsx',
      // Статьи сайта, канал (broadcast без userId).
      'src/articles/articles.seed.ts',
      'src/bot/healthy-adult.data.ts',
      // Заявка терапевта в личку владельцу (adminPlainText).
      'src/therapy/therapist-request.notify.ts',
      // Отчёт о публикации в канал — DM владельцу при сбое.
      'src/channel/publish-report.ts',
      // До входа — гость/разовый клиент, форма ещё не выбрана.
      'webapp/src/pages/LoginPage.tsx',
      'webapp/src/pages/BookingPaidPage.tsx',
      // Юридические документы.
      'webapp/src/pages/PrivacyPage.tsx',
      'webapp/src/pages/OfferPage.tsx',
      // Админка (отдельный ключ доступа, не пользователь приложения).
      'webapp/src/pages/admin/ArticleEditor.tsx',
      'webapp/src/pages/AdminPage.tsx',
      // Владелец-only диагностика/отчёты.
      'src/channel/targets/vk.target.ts',
      'src/telegram/telegram-channel.target.ts',
      'src/bot/healthy-adult.pool-alert.ts',
      'src/bot/auth-health-metrics.format.ts',
      // Мета-код детектора и нейтральная CTA-подпись к третьему лицу.
      'shared/src/utils/tyFormsSweep.ts',
      'shared/src/utils/therapistContact.ts',
    ];
    const unmatched = EXCLUDE.filter(
      (p) => !CORPUS.some((text) => new RegExp(p.source, p.flags).test(text)),
    );
    expect(unmatched).toEqual([]);
  });

  // Пара форм, переданная JSX-атрибутами: вилка стоит в компоненте-получателе
  // (`SaveErrorNote` делает `{tr(ty, vy)}`), то есть строки уже в механике.
  // Гейт понимал только объектную запись `{ty: '…', vy: '…'}` и считал долгом
  // все семь вызовов SaveErrorNote (свип 2026-08).
  it('пара ty=/vy= JSX-атрибутами на соседних строках — зелено', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'webapp/src/A.tsx': [
        'export const A = () => (',
        '  <SaveErrorNote',
        '    ty="Не удалось сохранить — попробуй ещё раз."',
        '    vy="Не удалось сохранить — попробуйте ещё раз."',
        '  />',
        ');',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it('пара ty=/vy= в одну строку — тоже зелено', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'webapp/src/A.tsx':
        'export const A = () => <Note ty="Попробуй ещё" vy="Попробуйте ещё" />;\n',
    });
    expect(res.status).toBe(0);
  });

  it('одиночный ty= без парного vy= — по-прежнему долг', () => {
    const res = runGate('check-second-person.mjs', {
      'scripts/second-person-baseline.json': JSON.stringify({}),
      'webapp/src/A.tsx':
        'export const A = () => <Note ty="Попробуй ещё" />;\n',
    });
    expect(res.status).toBe(1);
  });

  it('EXCLUDE не шире, чем нужно: LinkDevicePage.tsx НЕ распознаётся ни одним', () => {
    // Ровно та зона, которую координатор предложил исключить, а разбор
    // показал реальный долг (страница требует authenticated). Держит EXCLUDE
    // от повторного «эта зона выглядит похожей — тоже исключим».
    const matched = EXCLUDE.filter((p) =>
      new RegExp(p.source, p.flags).test('webapp/src/pages/LinkDevicePage.tsx'),
    );
    expect(matched).toEqual([]);
  });
});

// Слой распознавания разведённых форм (scripts/second-person-blanking.mjs)
// исполняется отсюда напрямую: иначе он был бы кодом, который никто не
// проверяет (правило 14, гейт check-unwatched-code). Проверяем его главное
// свойство — стирать содержимое, СОХРАНЯЯ длину строк и их количество: на
// этом держится верная нумерация строк в отчёте гейта.
describe('second-person-blanking.mjs: гашение сохраняет разметку строк', () => {
  it('кавычки-цитаты гасятся, число строк не меняется', () => {
    const src = ['const a = 1;', 'const q = "«Где ты это чувствуешь?»";'].join(
      '\n',
    );
    const out = callExport(
      'second-person-blanking.mjs',
      'blankQuotedSpans',
      src,
    );
    expect(out.split('\n')).toHaveLength(2);
    expect(out).not.toContain('чувствуешь');
  });

  it('пара ty/vy гасится, длина строк сохраняется', () => {
    const src = ["  ty: 'Попробуй ещё',", "  vy: 'Попробуйте ещё',"].join('\n');
    const out = callExport(
      'second-person-blanking.mjs',
      'blankTyVyObjectPairs',
      src,
    );
    const lines = out.split('\n');
    expect(lines[0]).toHaveLength(src.split('\n')[0].length);
    expect(lines[1]).toHaveLength(src.split('\n')[1].length);
    expect(out).not.toContain('Попробуй');
  });
});
