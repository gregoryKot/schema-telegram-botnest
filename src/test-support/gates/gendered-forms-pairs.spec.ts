// QA 2026-11 (B-З11, A-М7): мужской род в вопросе трекера «Принимал ли ты…
// Действовал из своих ценностей…», в примерах «Сказал нет просьбе», в
// цитате «ты мне важен» и в «Критик или забота?» («фразу, которую сказал
// себе») — гейт check-gendered-forms.mjs показывал 0. Причины: глагол стоял
// перед «ты» или «ты» не было вовсе, а «мне» между «ты» и «важен» не входило
// в FILLER. Закрыто двумя механизмами — пара tr('ты','вы')
// (gendered-forms-tr-pairs.mjs) и расширенные строчные паттерны. Оба исхода:
// краснеет на регрессе, молчит на законных строках.
import { runGate } from './gate-sandbox';
import { importExport, loadNamedPatterns } from './pattern-loader';

const EMPTY = { 'scripts/gendered-forms-baseline.json': JSON.stringify({}) };

describe('check-gendered-forms.mjs — пара tr(ты, вы)', () => {
  it('вы-вариант во множественном числе выдаёт мужской род ты-варианта — exit 1', () => {
    const res = runGate('check-gendered-forms.mjs', {
      ...EMPTY,
      'shared/src/needs/q.ts': [
        'export const q = (tr) => tr(',
        "  'Получилось ли сегодня отдохнуть? Действовал из своих ценностей?',",
        "  'Получилось ли сегодня отдохнуть? Действовали из своих ценностей?',",
        ');',
        "export const e = (tr) => tr('Сказал нет просьбе', 'Сказали нет просьбе');",
        "export const s = (form) => t(form, 'Справишься сам', 'Справитесь сами');",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('L2 [tr-pair-m] Действовал (вы: действовали)');
    expect(res.stderr).toContain('L5 [tr-pair-m] Сказал (вы: сказали)');
    expect(res.stderr).toContain('L6 [tr-pair-m] сам (вы: сами)');
  });

  it('род у третьего лица, безличный ты-вариант и настоящее время — гейт молчит', () => {
    const res = runGate('check-gendered-forms.mjs', {
      ...EMPTY,
      'shared/src/needs/q.ts': [
        // «сказал» согласовано с «Партнёр» — в вы-варианте оно то же.
        "export const a = (tr) => tr('Партнёр сказал что-то тёплое', 'Партнёр сказал что-то тёплое');",
        // Ты-вариант снят безличным оборотом — вот как правило и чинится.
        "export const b = (tr) => tr('Получилось сказать нет', 'Сказали нет');",
        "export const c = (tr) => tr('Запиши фразу, которую говоришь себе', 'Запишите фразу, которую сказали себе');",
        // «план» во множественном числе — «планы», а не «плани»: слово не глагол.
        "export const d = (tr) => tr('Твой план на день', 'Ваши планы на день');",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });
});

// Модуль правила напрямую (scripts/gendered-forms-tr-pairs.mjs): форма
// множественного числа и строка находки — без песочницы CLI.
describe('gendered-forms-tr-pairs.mjs', () => {
  const call = <T>(exportName: string, arg: string): T =>
    JSON.parse(
      importExport(
        'gendered-forms-tr-pairs.mjs',
        exportName,
        `(f) => f(${JSON.stringify(arg)})`,
      ),
    ) as T;

  it.each([
    ['Сказал', 'сказали'],
    ['вернулся', 'вернулись'],
    ['смог', 'смогли'],
    ['готов', 'готовы'],
    ['сам', 'сами'],
  ])('pluralOfMasculine(«%s») → «%s»', (word, plural) => {
    expect(call<string>('pluralOfMasculine', word)).toBe(plural);
  });

  it.each([['план'], ['мысль'], ['говоришь']])(
    'pluralOfMasculine(«%s») → null: не мужская форма глагола',
    (word) => {
      expect(call<string | null>('pluralOfMasculine', word)).toBeNull();
    },
  );

  // Кандидат «столи» у существительного на «-л» бессмыслен, но и не опасен:
  // находка — только если вы-вариант содержит ровно эту форму.
  it('trPairHits: существительное на «-л» не находка — «столы», а не «столи»', () => {
    expect(call('trPairHits', "tr('Твой стол', 'Ваши столы')")).toEqual([]);
  });

  it('trPairHits: строка находки — строка ты-литерала, не вызова', () => {
    const src =
      "x\nconst q = tr(\n  'Действовал из ценностей',\n  'Действовали из ценностей',\n);\n";
    expect(call('trPairHits', src)).toEqual([
      { line: 3, word: 'Действовал', plural: 'действовали' },
    ]);
  });
});

describe('строчные паттерны — классы, найденные QA 2026-11', () => {
  const PATTERNS = loadNamedPatterns('gendered-forms-patterns.mjs', 'PATTERNS');
  const hits = (name: string, text: string) => {
    const p = PATTERNS.find((x) => x.name === name)!;
    return new RegExp(p.source, p.flags).test(text);
  };

  it.each([
    ['ty-past', 'Принимал ли ты сегодня решения из себя?'],
    ['ty-short-adj', 'Близкий сказал: «ты мне важен»'],
    ['ty-short-adj', 'Услышать «ты для меня дорог» бывает трудно'],
    ['ya-short-adj', 'Скажи «я не согласен» без оправданий'],
    ['reflexive-samogo-m', 'Поиграй в слова с кем-то или с самим собой'],
    ['inf-adj-m', 'Запиши, что делает тебя способным говорить нет'],
  ] as const)('«%s» ловит «%s»', (name, text) => {
    expect(hits(name, text)).toBe(true);
  });

  it.each([
    [
      'ty-past',
      'Сработал ли план, который был на сегодня?',
      'нет «ты»: род у слова «план»',
    ],
    [
      'ty-past',
      'Принимали ли вы сегодня решения из себя?',
      'форма «вы» рода не имеет',
    ],
    [
      'ty-short-adj',
      'Скажи кому-то, что он важен для тебя',
      'род у «он», не у читателя',
    ],
    [
      'inf-adj-m',
      'Заметь, что делает это безопасным для тебя',
      '«это» — средний род',
    ],
    [
      'reflexive-samogo-m',
      'Поиграй в слова с кем-то или в одиночку',
      'нейтральная замена',
    ],
  ] as const)('«%s» НЕ ловит «%s» (%s)', (name, text) => {
    expect(hits(name, text)).toBe(false);
  });
});
