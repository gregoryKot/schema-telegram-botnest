// Тест гейта check-gendered-forms.mjs (свип 2026-08): пофайловый храповик
// мужского рода в текстах, обращённых к пользователю. Продукт по умолчанию
// говорит на «ты», а «ты сделал» / «позволь себе быть сильным» для половины
// читателей звучит как написанное не им.
//
// Проверяются оба исхода: гейт краснеет на регрессе И зеленеет на чистом
// дереве. Второй не менее важен — ложно-красный гейт отключают через неделю.
import { runGate } from './gate-sandbox';
import { loadNamedPatterns, loadRegexList } from './pattern-loader';

describe('check-gendered-forms.mjs', () => {
  it('новый файл с «ты сделал» — exit 1', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': "export const msg = 'Ты сделал шаг навстречу себе';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/foo.ts: новый файл с 1 мужскими формами');
    expect(res.stderr).toContain('[ty-past] Ты сделал');
  });

  it('ловит краткое прилагательное «ты не обязан»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': "export const msg = 'Ты не обязан быть в форме сегодня';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[ty-short-adj] Ты не обязан');
  });

  it('ловит скобочный костыль «сделал(а)»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': "export const msg = 'Я обречён(а) быть в одиночестве';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[brackets] обречён(а)');
  });

  it('ловит «позволь себе быть сильным» (прилагательное про читателя)', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': "export const msg = 'Позволь себе не быть сильным';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[inf-adj-m] быть сильным');
  });

  it('ловит читателя, названного уменьшительным: «маленький я», «себе-маленькому»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Дорогой маленький я,';",
        "export const b = 'Сказать себе-маленькому то, что нужно';",
        "export const c = 'нужна забота — как маленькому, которого не обнимали';",
        "export const d = 'Внутри — маленький и уязвимый, рядом никого';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[child-self-m] маленький я');
    expect(res.stderr).toContain('[child-self-m] себе-маленькому');
  });

  it('«маленький» при существительном — законно, гейт молчит', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Один маленький шаг — уже много';",
        "export const b = 'нужна забота — как ребёнку, которого не обнимали';",
        "export const c = 'Дорогой мой ребёнок,';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it('законная конструкция в строке не прячет мужской род рядом с ней', () => {
    // Исключения гасят свой фрагмент, а не всю строку. Реальный пропуск:
    // «Здоровый Взрослый слышит тебя: … и ты не один» — ALLOW на «Здоровый
    // Взрослый» делал невидимым «ты не один» в той же строке.
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts':
        "export const m = 'Здоровый Взрослый слышит тебя: боль настоящая, и ты не один.';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[ty-short-adj] ты не один');
  });

  it('ловит мужское прошедшее с опущенным подлежащим', () => {
    // «Научился прятать» — рассказ читателя о себе, где «я»/«ты» не написано,
    // поэтому правила на «ты …л» его не видят (колесо детства, свип 2026-08).
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Чувства было опасно показывать. Научился прятать.';",
        "export const b = 'Злость каралась. Выучил правило: наружу не выносить.';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[dropped-subject-past]');
  });

  it('при явном подлежащем прошедшее не считается — род принадлежит ему', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Внутренний Критик перестал атаковать';",
        "export const b = 'Рядом оказывался взрослый, который это замечал';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it('рост счётчика в известном файле — exit 1 с «было → стало»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({
        'src/known.ts': 1,
      }),
      'src/known.ts': [
        "export const a = 'Ты сделал первый шаг';",
        "export const b = 'Ты вернулся после перерыва';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/known.ts: 1 → 2');
  });

  // Слепые зоны свипа 2026-08 (см. шапку check-gendered-forms.mjs) — по одному
  // тесту на регресс И минимум одному контрольному тесту на законный случай,
  // чтобы новый паттерн не стал ложно-красным.

  it('(а) dropped-subject-past ловит расширенный список глаголов', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Ждали разговора. Справился один, без чужой помощи.';",
        "export const b = 'Экзамен сдан. Устал, но не жалею.';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[dropped-subject-past] . Справился');
    expect(res.stderr).toContain('[dropped-subject-past] . Устал');
  });

  it('(б) solo-verb-m ловит «сам»/«один» как цель рядом с глаголом 1/2 лица', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Справлюсь сам, помощь не нужна.';",
        "export const b = 'Если не позвонишь — останусь один.';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[solo-verb-m] Справлюсь сам');
    expect(res.stderr).toContain('[solo-verb-m] останусь один');
  });

  it('(б) «сам по себе» и «один раз»/«один из» — идиомы, не про род', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.ts': [
        "export const a = 'Справлюсь сам по себе, это не проблема.';",
        "export const b = 'Загляну один раз в неделю, этого хватит.';",
        "export const c = 'Выбери один из вариантов ниже.';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });

  it('(б) reflexive-samogo-m ловит «себя самого»/«собой самим»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts':
        "export const a = 'Прежде чем заботиться о других, начни с себя самого.';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[reflexive-samogo-m] себя самого');
  });

  it('(б) «с самого начала» — «самого» относится к другому слову, не к «себя»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.ts':
        "export const a = 'Тепло было с самого начала разговора.';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });

  it('(в) ya-short-adj ловит расширенный список кратких прилагательных', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Я уверен, что справлюсь.';",
        "export const b = 'Сегодня я снова уязвим.';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[ya-short-adj] Я уверен');
    expect(res.stderr).toContain('[ya-short-adj] я снова уязвим');
  });

  it('(г) inf-adj-m ловит спрягаемые формы и наречие-разделитель', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Есть отношения, в которых я чувствую себя одиноким.';",
        "export const b = 'Страшно оказаться недостаточным для других.';",
        "export const c = 'Хочется быть максимально продуктивным каждый день.';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[inf-adj-m] чувствую себя одиноким');
    expect(res.stderr).toContain('[inf-adj-m] оказаться недостаточным');
    expect(res.stderr).toContain('[inf-adj-m] быть максимально продуктивным');
  });

  it('(г) inf-adj-m не путает короткое местоимение «ним» с прилагательным', () => {
    // Порог в 2 буквы основы перед «ым/им» — без него «быть рядом с ним»
    // ловился бы как «X-им», хотя «ним» — не прилагательное, а местоимение.
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.ts':
        "export const a = 'Поддержка — это когда можно просто быть рядом с ним.';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });

  it('снижение счётчика — exit 0, предлагает зафиксировать --update', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({
        'src/known.ts': 2,
      }),
      'src/known.ts': "export const a = 'Ты сделал первый шаг';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 < 2 — стало лучше');
  });

  // Аудит 2026-10: статусы клиента в кабинете терапевта («активен сегодня»,
  // «был недавно», «не активен») и партнёра по паре («Ещё не заполнил») —
  // мужской род о человеке, чей пол неизвестен. Подлежащего в подписи нет,
  // поэтому правила про «ты»/«я» их не видели: гейт давал 0 на этих файлах.
  it('status-label-m ловит статусную подпись в литерале, JSX и после ${имя}', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts':
        "export const a = (d: string | null) => (d ? 'был недавно' : 'не активен');\n",
      'src/bar.tsx':
        'export const B = () => <span className="ds-badge">был сегодня</span>;\n',
      'src/baz.tsx': [
        'export const C = () => (',
        '  <div>',
        '    Ещё не заполнил',
        '  </div>',
        ');',
        'export const m = (name: string) => `${name} ещё не заполнил дневник — позже`;',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[status-label-m] 'был недавно");
    expect(res.stderr).toContain("[status-label-m] 'не активен");
    expect(res.stderr).toContain(
      'src/bar.tsx: новый файл с 1 мужскими формами',
    );
    expect(res.stderr).toContain('[status-label-m] >был сегодня');
    expect(res.stderr).toContain(
      'src/baz.tsx: новый файл с 2 мужскими формами',
    );
    expect(res.stderr).toContain('[status-label-m] ${name} ещё не заполнил');
  });

  it('status-label-m молчит на безличных подписях и законном мужском роде', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.tsx': [
        "export const a = (d: string | null) => (d ? 'активность недавно' : 'нет активности');",
        "export const b = 'Нет активности';",
        'export const B = () => <span className="ds-badge">активность сегодня</span>;',
        "export const c = 'Если этот режим активен — стоит поговорить с терапевтом.';",
        "export const d = 'Клиент ещё не заполнил карточки схем или режимов';",
        "export const e = 'Был стабильный взрослый, которому можно было доверять.';",
        'export const f = (x: number) => `Вчера индекс был ${x}`;',
        'export const g = (who: string) => `${who} не ответил вовремя`;',
        'export const h = (n: string) => `Записи за сегодня пока нет — когда ${n} заполнит дневник`;',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });

  // Ложно-красный гейт хуже отсутствующего: он заставляет коверкать язык.
  it('форма «вы» рода не имеет — не считается регрессом', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.ts': "export const msg = 'Вы сделали шаг навстречу себе';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });

  it('нейтральная формулировка в настоящем времени — exit 0', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.ts':
        "export const msg = 'Третий раз перечитываешь своё сообщение';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });

  // «психолог» кончается на «ог» — не прошедшее время; «живой человек» —
  // мужской род принадлежит слову «человек», а не читателю.
  it('мужской род у другого слова и существительные — не срабатывает', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.ts': [
        "export const a = 'Я психолог и работаю со схемами';",
        "export const b = 'Рядом живой человек, а не бот';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });
});

// Механизм вместо добросовестности (как shared/src/utils/crisisMarkers.test.ts):
// тесты выше бьют по CLI через известные строки и НЕ пинят каждый паттерн —
// замер 2026-08-13 показал, что отключение регэкспа 4 из 10 паттернов
// (bud-ty-past, ty-irregular, ya-past, ya-short-adj) не роняло ни один из них.
// Поэтому здесь у КАЖДОГО паттерна PATTERNS и каждого исключения ALLOW —
// живой образец, который ловит/гасит именно он. Новый паттерн без образца в
// POSITIVE роняет первый тест ниже сразу.
describe('каждый паттерн и ALLOW-исключение пойманы своим образцом', () => {
  const PATTERNS = loadNamedPatterns('gendered-forms-patterns.mjs', 'PATTERNS');
  const ALLOW = loadRegexList('gendered-forms-patterns.mjs', 'ALLOW');

  const POSITIVE: Record<string, string> = {
    'ty-past': 'Ты сделал первый шаг',
    'bud-ty-past': 'Даже если бы ты остался, ничего бы не изменилось',
    'ty-irregular': 'Ты вырос из этого страха',
    'ty-short-adj': 'Ты не обязан быть в форме сегодня',
    'ya-past': 'Скажи себе: «Я забыл, каково это»',
    'ya-short-adj': 'Ругаю себя: я плохой',
    'solo-verb-m': 'Справлюсь сам, помощь не нужна',
    'reflexive-samogo-m': 'Начни с себя самого',
    'inf-adj-m': 'Позволь себе не быть сильным',
    'child-self-m': 'Дорогой маленький я,',
    'dropped-subject-past': 'Чувства было опасно показывать. Научился прятать.',
    brackets: 'Я обречён(а) быть в одиночестве',
    'status-label-m': "x ? 'активен сегодня' : y",
  };

  it('в PATTERNS нет имени без образца в POSITIVE', () => {
    const missing = PATTERNS.map((p) => p.name).filter((n) => !(n in POSITIVE));
    expect(missing).toEqual([]);
  });

  // Правило статусных подписей живёт в отдельном модуле (храповик размера,
  // правило №10). Пин: модуль загружается сам и каждое его правило реально
  // подключено в PATTERNS — иначе выпавший спред `...STATUS_PATTERNS` молча
  // выключил бы правило, а тест выше этого бы не заметил.
  it('каждое правило gendered-forms-status-patterns.mjs подключено в PATTERNS', () => {
    const STATUS = loadNamedPatterns(
      'gendered-forms-status-patterns.mjs',
      'STATUS_PATTERNS',
    );
    expect(STATUS.map((p) => p.name)).toEqual(['status-label-m']);
    for (const s of STATUS) {
      const p = PATTERNS.find((x) => x.name === s.name);
      expect(p).toEqual(s);
    }
  });

  it.each(PATTERNS.map((p) => [p.name] as const))(
    'паттерн «%s» ловит свой образец',
    (name) => {
      const p = PATTERNS.find((x) => x.name === name)!;
      const re = new RegExp(p.source, p.flags);
      expect(re.test(POSITIVE[name])).toBe(true);
    },
  );

  // Задокументированные в комментариях исключения: паттерн НЕ обязан их ловить.
  it.each([
    ['ty-past', 'Ты психолог', 'существительное на «ог» — не прошедшее время'],
    [
      'ty-past',
      'Ты помог мне сегодня',
      '«ог/ёг» намеренно исключены из PAST_M',
    ],
    ['ya-past', 'Я психолог и работаю со схемами', 'то же для «я»'],
    [
      'child-self-m',
      'Один маленький шаг — уже много',
      'прилагательное при существительном — законно',
    ],
    [
      'child-self-m',
      'нужна забота — как ребёнку, которого не обнимали',
      'то же',
    ],
    [
      'dropped-subject-past',
      'Внутренний Критик перестал атаковать',
      'явное подлежащее — род принадлежит ему',
    ],
    [
      'solo-verb-m',
      'Справлюсь сам по себе, это не проблема',
      '«сам по себе» — идиома, не про род',
    ],
    [
      'solo-verb-m',
      'Загляну один раз в неделю',
      '«один раз» — про количество, не про одиночество',
    ],
    [
      'solo-verb-m',
      'Выбери один из вариантов',
      '«один из» — не про одиночество',
    ],
    [
      'reflexive-samogo-m',
      'Тепло было с самого начала разговора',
      '«самого» относится к «начала», а не к «себя»',
    ],
    [
      'inf-adj-m',
      'Поддержка — это когда можно просто быть рядом с ним',
      '«ним» короче порога основы — не прилагательное',
    ],
    [
      'status-label-m',
      "tip: 'Если этот режим активен — стоит поговорить с терапевтом'",
      'род принадлежит слову «режим», и слово не открывает литерал',
    ],
    [
      'status-label-m',
      "'Клиент ещё не заполнил карточки схем или режимов'",
      'род согласован с существительным «Клиент» — законно',
    ],
    [
      'status-label-m',
      "'Был стабильный взрослый, которому можно было доверять.'",
      'длинная фраза, а не статусная подпись: после «Был» больше двух слов',
    ],
    [
      'status-label-m',
      '`Вчера индекс был ${x}`',
      '«был» при подлежащем «индекс», не в начале литерала',
    ],
    [
      'status-label-m',
      '`${who} не ответил`',
      '«ответил» не в списке: так пишут о площадке (Google/VK)',
    ],
    [
      'status-label-m',
      "'Рядом живой человек, а не бот'",
      'мужской род у слова «человек»',
    ],
    [
      'status-label-m',
      "x ? 'активность сегодня' : 'Нет активности'",
      'безличная подпись — то, на что правило и переводит',
    ],
  ] as const)('паттерн «%s» НЕ ловит «%s» (%s)', (name, text) => {
    const p = PATTERNS.find((x) => x.name === name)!;
    const re = new RegExp(p.source, p.flags);
    expect(re.test(text)).toBe(false);
  });

  it('у каждого ALLOW-исключения есть образец, который оно распознаёт', () => {
    const CORPUS = [
      'рядом живой человек, а не бот',
      'рядом оказывался стабильный взрослый',
      'Клиент должен сам решить, что делать',
      'кто должен быть близким',
      'нужно любому',
      'бесплатное веб-приложение, которое я создал для самостоятельной работы',
      'Я работаю в подходе схема-терапия и сделал «Всё по схеме» бесплатным',
      'что он важен',
      'кто готов слушать',
      'Я бы притормозил с глубинной работой и начал иначе',
      'В практике я заметил, что вопрос',
    ];
    const unmatched = ALLOW.filter(
      (p) => !CORPUS.some((text) => new RegExp(p.source, p.flags).test(text)),
    );
    expect(unmatched).toEqual([]);
  });

  // Точечные ALLOW не должны стать по факту широкими: похожая, но НЕзаконная
  // фраза — «я» + прошедшее время без привязки к автору-практику/создателю
  // продукта — обязана по-прежнему ловиться паттерном ya-past.
  it.each([
    [
      'Я бы притормозил с покупкой, если бы знал заранее',
      '«Я бы притормозил» без «с глубинной работой» — другой контекст, не должно гаситься',
    ],
    [
      'В детстве я заметил, что мне не становится легче',
      '«я заметил» без «в практике» — реплика читателя о себе, не автора',
    ],
    [
      'мобильное приложение, которое я скачал для дневника',
      '«которое я скачал» — не «создал», ALLOW не должен ловить произвольный глагол',
    ],
  ] as const)('ALLOW НЕ гасит похожую незаконную фразу «%s» (%s)', (text) => {
    const matched = ALLOW.some((p) => new RegExp(p.source, p.flags).test(text));
    expect(matched).toBe(false);
    // И убеждаемся, что паттерн ya-past её всё равно ловит — то есть гейт
    // действительно бы среагировал, если бы такая строка попала в код.
    const p = PATTERNS.find((x) => x.name === 'ya-past')!;
    const re = new RegExp(p.source, p.flags);
    expect(re.test(text)).toBe(true);
  });
});
