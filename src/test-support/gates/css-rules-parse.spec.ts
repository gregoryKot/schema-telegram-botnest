// Тест разборщика scripts/css-rules-parse.mjs — движка гейта
// check-hover-only-reveal.mjs. Если разборщик ошибся (потерял правило,
// сдвинул номер строки, принял @keyframes за состояние элемента), гейт
// молчит о настоящей находке или краснеет на анимации — оба исхода
// гейт-тест через CLI видит только косвенно. Здесь разборщик пинится
// напрямую (образец — gate-strip-comments.spec.ts).
import { importExport } from './pattern-loader';

interface Rule {
  selector: string;
  decls: Record<string, string>;
  ctx: string[];
  line: number;
}

const parse = (css: string): Rule[] =>
  JSON.parse(
    importExport(
      'css-rules-parse.mjs',
      'parseCssRules',
      `(fn) => fn(${JSON.stringify(css)})`,
    ),
  ) as Rule[];

const split = (selector: string): string[] =>
  JSON.parse(
    importExport(
      'css-rules-parse.mjs',
      'splitSelectorList',
      `(fn) => fn(${JSON.stringify(selector)})`,
    ),
  ) as string[];

describe('css-rules-parse.mjs — parseCssRules', () => {
  it('правило: селектор, объявления, номер строки первой строки селектора', () => {
    const rules = parse(
      '\n.a { opacity: 0; color: red }\n\n.b\n{ top: 1px }\n',
    );
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({
      selector: '.a',
      decls: { opacity: '0', color: 'red' },
      ctx: [],
      line: 2,
    });
    expect(rules[1].selector).toBe('.b');
    expect(rules[1].line).toBe(4);
  });

  it('правила внутри @keyframes отбрасываются — это анимация, а не состояние', () => {
    const rules = parse(
      [
        '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }',
        '@-webkit-keyframes slide {',
        '  0% { opacity: 0; }',
        '}',
        '.x { opacity: 0; }',
      ].join('\n'),
    );
    expect(rules.map((r) => r.selector)).toEqual(['.x']);
  });

  it('@media: правило получает ctx с предусловием и свою строку', () => {
    const rules = parse(
      [
        '.x { opacity: 0; }',
        '@media (hover: none), (pointer: coarse) {',
        '  .x { opacity: 1; }',
        '}',
      ].join('\n'),
    );
    expect(rules).toHaveLength(2);
    expect(rules[0].ctx).toEqual([]);
    expect(rules[1].ctx).toEqual(['@media (hover: none), (pointer: coarse)']);
    expect(rules[1].line).toBe(3);
  });

  it('вложенные at-правила: ctx идёт снаружи внутрь', () => {
    const rules = parse(
      '@supports (display: grid) { @media (hover: none) { .x { opacity: 1 } } }',
    );
    expect(rules[0].ctx).toEqual([
      '@supports (display: grid)',
      '@media (hover: none)',
    ]);
  });

  it('`;` и `{` внутри кавычек и url(…) не рвут объявление', () => {
    const rules = parse(
      [
        ':root { --c: url("data:image/svg+xml,%3Csvg a=\'1\';{x}%3E") 6 20; }',
        ".y { content: ';{'; background: url(data:a;b{c}); }",
        '.x { opacity: 0; }',
      ].join('\n'),
    );
    expect(rules.map((r) => r.selector)).toEqual([':root', '.y', '.x']);
    expect(rules[0].decls['--c']).toContain('data:image/svg+xml');
    expect(rules[1].decls.content).toBe("';{'");
    expect(rules[1].decls.background).toBe('url(data:a;b{c})');
    expect(rules[2].line).toBe(3);
  });

  it('!important отбрасывается из значения, имя свойства в нижнем регистре', () => {
    const rules = parse('.x { Opacity: 1 !important }');
    expect(rules[0].decls).toEqual({ opacity: '1' });
  });
});

describe('css-rules-parse.mjs — splitSelectorList', () => {
  it('делит по запятым верхнего уровня', () => {
    expect(split('.a:hover .x, .b:focus-within .x')).toEqual([
      '.a:hover .x',
      '.b:focus-within .x',
    ]);
  });

  it('запятая внутри :is(…) и [attr="a,b"] не делит', () => {
    expect(split('.a, :is(.b, .c)')).toHaveLength(2);
    expect(split('[data-x="a,b"], .c')).toEqual(['[data-x="a,b"]', '.c']);
  });

  it('пустой хвост после запятой не даёт пустого селектора', () => {
    expect(split('.a,')).toEqual(['.a']);
  });
});
