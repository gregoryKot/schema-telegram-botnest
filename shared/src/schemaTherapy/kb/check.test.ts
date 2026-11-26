// Тест самого сторожа (правило: гейт — оба исхода): функции kb/check.ts и kb/mentions.ts на фейках
// ловят пропуск, лишний id и протухшую строку gaps и пропускают правильные данные.
import { describe, expect, it } from 'vitest';
import {
  coverage,
  coverageProblems,
  danglingEdges,
  discover,
  entryProblems,
  gapProblems,
  type KbTable,
} from './check';
import { mentionedModes, modeNamePattern } from './mentions';

const IDS = ['a_mode', 'b_mode', 'c_mode'];
const yes = () => true;

describe('coverage', () => {
  it('ловит пропуск и лишний id, legacy не лишний', () => {
    expect(coverage(['a_mode', 'x_old', 'typo'], IDS, ['x_old'])).toEqual({
      missing: ['b_mode', 'c_mode'],
      extra: ['typo'],
    });
  });
  it('полная таблица — пусто', () => {
    expect(coverage(IDS, IDS)).toEqual({ missing: [], extra: [] });
  });
});

describe('coverageProblems', () => {
  const t: KbTable = {
    file: 'shared/x.ts',
    kind: 'mode',
    coverage: 'all',
    keys: () => ['a_mode'],
  };
  it('называет файл и id и говорит, что сделать', () => {
    expect(coverageProblems(t, IDS, () => '')).toContain(
      'добавить строку для режима b_mode в shared/x.ts',
    );
  });
  it('subset не требует полноты, но ловит чужой id', () => {
    const sub = {
      ...t,
      coverage: 'subset' as const,
      why: 'w',
      keys: () => ['a_mode', 'zz'],
    };
    const out = coverageProblems(sub, IDS, () => '');
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('zz');
  });
  it('без keys сверяет текст файла', () => {
    const byText: KbTable = {
      file: 'src/y.ts',
      kind: 'mode',
      coverage: 'all',
      syncSpec: 's',
    };
    expect(
      coverageProblems(
        byText,
        IDS,
        () => "{ a_mode: 1, 'b_mode': 2, c_mode: 3 }",
      ),
    ).toEqual([]);
    expect(coverageProblems(byText, IDS, () => '{ a_mode: 1 }')).toHaveLength(
      2,
    );
  });
});

describe('entryProblems', () => {
  it('subset без why, частичная внешняя без сверки, несуществующий syncSpec — красные', () => {
    const bad: KbTable = {
      file: 'webapp/z.ts',
      kind: 'mode',
      coverage: 'subset',
      syncSpec: 'nope',
    };
    const out = entryProblems(bad, (f) => f !== 'nope');
    expect(out.some((m) => m.includes('без why'))).toBe(true);
    expect(out.some((m) => m.includes('syncSpec nope'))).toBe(true);
    const noSpec = entryProblems(
      { ...bad, why: 'причина', syncSpec: undefined },
      yes,
    );
    expect(noSpec.some((m) => m.includes('нужен syncSpec'))).toBe(true);
  });
  it('правильная запись — пусто', () => {
    const ok: KbTable = {
      file: 'shared/x.ts',
      kind: 'mode',
      coverage: 'subset',
      why: 'w',
      keys: () => [],
    };
    expect(entryProblems(ok, yes)).toEqual([]);
  });
});

describe('discover, danglingEdges, gapProblems', () => {
  it('считает разные id среди литералов и ключей, с префиксом вида', () => {
    expect(
      discover(
        "const X = { a_mode: 1, 'technique:b_mode': 2, c: 'c_mode a_mode' }",
        IDS,
      ),
    ).toBe(2);
  });
  it('ребро в несуществующий id — красное', () => {
    expect(
      danglingEdges(
        [
          ['s', 'a_mode'],
          ['s', 'gone'],
        ],
        IDS,
      ),
    ).toEqual([['s', 'gone']]);
  });
  it('протухшая и чужая строка gaps, неучтённая дыра', () => {
    expect(gapProblems(['a_mode'], ['b_mode', 'ghost'], IDS)).toEqual({
      unlisted: ['a_mode'],
      stale: ['b_mode'],
      unknown: ['ghost'],
    });
    expect(gapProblems(['a_mode'], ['a_mode'], IDS)).toEqual({
      unlisted: [],
      stale: [],
      unknown: [],
    });
  });
});

describe('названия режимов в тексте', () => {
  const modes = [
    { id: 'vc', name: 'Уязвимый Ребёнок' },
    { id: 'oc', name: 'Гиперконтролёр' },
    { id: 'soc', name: 'Подозрительный Гиперконтролёр' },
    { id: 'inv', name: 'Неуязвимый Гиперконтролёр' },
  ];
  it('ловит падежи и ё/е, не ловит «Неуязвимого» как «Уязвимого»', () => {
    expect(
      modeNamePattern('Уязвимый Ребёнок').test('слово Уязвимому ребенку'),
    ).toBe(true);
    expect(mentionedModes('Неуязвимого Гиперконтролёра', modes)).toEqual([
      'inv',
    ]);
  });
  it('длинное название не засчитывает короткое, однословное — с учётом регистра', () => {
    expect(mentionedModes('Подозрительный Гиперконтролёр', modes)).toEqual([
      'soc',
    ]);
    expect(mentionedModes('гиперконтролёр и гиперкомпенсация', modes)).toEqual(
      [],
    );
    expect(mentionedModes('Гиперконтролёра', modes)).toEqual(['oc']);
  });
});
