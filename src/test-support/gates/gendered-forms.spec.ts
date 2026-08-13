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
  const PATTERNS = loadNamedPatterns('check-gendered-forms.mjs', 'PATTERNS');
  const ALLOW = loadRegexList('check-gendered-forms.mjs', 'ALLOW');

  const POSITIVE: Record<string, string> = {
    'ty-past': 'Ты сделал первый шаг',
    'bud-ty-past': 'Даже если бы ты остался, ничего бы не изменилось',
    'ty-irregular': 'Ты вырос из этого страха',
    'ty-short-adj': 'Ты не обязан быть в форме сегодня',
    'ya-past': 'Скажи себе: «Я забыл, каково это»',
    'ya-short-adj': 'Ругаю себя: я плохой',
    'inf-adj-m': 'Позволь себе не быть сильным',
    'child-self-m': 'Дорогой маленький я,',
    'dropped-subject-past': 'Чувства было опасно показывать. Научился прятать.',
    brackets: 'Я обречён(а) быть в одиночестве',
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
      'который я создал',
      'что он важен',
      'кто готов слушать',
    ];
    const unmatched = ALLOW.filter(
      (p) => !CORPUS.some((text) => new RegExp(p.source, p.flags).test(text)),
    );
    expect(unmatched).toEqual([]);
  });
});
