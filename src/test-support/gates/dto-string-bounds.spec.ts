// Тест гейта check-dto-string-bounds.mjs (находка аудита 2026-10-11):
// строковое поле DTO обязано иметь верхнюю границу. Образец беды —
// `VirtualClientDto.name` с одним `@IsString()`: тело до 256 КБ ложилось в
// `virtualClientName` и уходило в каждый ответ `GET /clients`.
//
// Сломанный гейт не краснеет — поэтому оба исхода: красный на поле без
// границы и зелёный на чистом дереве; и для каждого вида «границы» (правило
// №15 п.2) — образец, который он гасит, И контрольный похожий, который
// по-прежнему краснеет.
import { execFileSync } from 'child_process';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { runGate, REAL_SCRIPTS_DIR } from './gate-sandbox';

const VALIDATOR = "import * as v from 'class-validator';\n";
const dto = (...members: string[]) =>
  `${VALIDATOR}export class FooDto {\n${members.join('\n')}\n}\n`;

const run = (files: Record<string, string>, baseline: object = {}) =>
  runGate('check-dto-string-bounds.mjs', {
    'scripts/dto-string-bounds-baseline.json': JSON.stringify(baseline),
    ...files,
  });
const foo = (source: string, baseline: object = {}) =>
  run({ 'src/foo/foo.dto.ts': source }, baseline);

describe('check-dto-string-bounds.mjs', () => {
  it('@IsString() без границы — exit 1, называет файл, класс и поле', () => {
    const res = foo(dto('  @v.IsString()', '  name!: string;'));
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/foo/foo.dto.ts — FooDto.name');
    expect(res.stderr).toContain('@MaxLength');
  });

  it('@IsString() с @MaxLength — exit 0', () => {
    const res = foo(
      dto('  @v.IsString()', '  @v.MaxLength(100)', '  name!: string;'),
    );
    expect(res.status).toBe(0);
  });

  it.each([
    ['Length', "@v.Length(1, 50, { message: 'x' })"],
    ['IsIn', "@v.IsIn(['a', 'b'])"],
    ['IsEnum', '@v.IsEnum(Kind)'],
    ['IsUUID', '@v.IsUUID()'],
    ['IsISO8601', '@v.IsISO8601()'],
    ['IsEmail', '@v.IsEmail()'],
  ])('%s ограничивает длину — exit 0', (_n, deco) => {
    const res = foo(dto('  @v.IsString()', `  ${deco}`, '  f!: string;'));
    expect(res.status).toBe(0);
  });

  it.each([
    ['@IsNotEmpty (нижняя граница)', '@v.IsNotEmpty()'],
    ['@Matches без квантора', '@Matches(/^[a-z]/)'],
    ['@IsOptional', '@v.IsOptional()'],
  ])('контрольный образец: %s границей не считается — exit 1', (_n, deco) => {
    const res = foo(dto('  @v.IsString()', `  ${deco}`, '  f!: string;'));
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('FooDto.f');
  });

  it('границу ставят на своей строке, на нескольких строках и с ValidateIf', () => {
    const res = foo(
      dto(
        '  @IsOptional()',
        '  @ValidateIf((_, val) => val !== null)',
        '  @IsString()',
        '  @MaxLength(',
        '    LIMIT,',
        "    { message: 'слишком длинно' },",
        '  )',
        '  title?: string | null;',
      ),
    );
    expect(res.status).toBe(0);
  });

  it('границы соседнего поля не хватает: второе поле без @MaxLength — exit 1', () => {
    const res = foo(
      dto(
        '  @IsString()',
        '  @MaxLength(10)',
        '  a!: string;',
        '',
        '  @IsString()',
        '  b!: string;',
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('FooDto.b');
    expect(res.stderr).not.toContain('FooDto.a');
  });

  it('@IsString({ each: true }) требует границу с each: true', () => {
    const bare = foo(
      dto(
        '  @IsString({ each: true })',
        '  @MaxLength(10)',
        '  ids!: string[];',
      ),
    );
    expect(bare.status).toBe(1);
    expect(bare.stderr).toContain('FooDto.ids');
    const each = foo(
      dto(
        '  @IsString({ each: true })',
        '  @MaxLength(10, { each: true })',
        '  ids!: string[];',
      ),
    );
    expect(each.status).toBe(0);
  });

  it('декоратор в комментарии не засчитывается, поле остаётся без границы', () => {
    const res = foo(
      dto(
        '  // @MaxLength(100) — добавим потом',
        '  /* @MaxLength(100) */',
        '  @IsString()',
        '  name!: string;',
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('FooDto.name');
  });

  it('поле без @IsString (число, булево) и файл без class-validator не трогаются', () => {
    const ok = foo(dto('  @v.IsInt()', '  n!: number;'));
    expect(ok.status).toBe(0);
    const plain = foo(
      'export class NotDto {\n  @IsString()\n  x!: string;\n}\n',
    );
    expect(plain.status).toBe(0);
  });

  it('спек и e2e-спек не сканируются', () => {
    const res = run({
      'src/foo/foo.dto.spec.ts': dto('  @IsString()', '  name!: string;'),
    });
    expect(res.status).toBe(0);
  });

  it('метод в классе не сбивает разбор следующих полей', () => {
    const res = foo(
      dto(
        '  @IsString()',
        '  @MaxLength(5)',
        '  a!: string;',
        '  get label(): string {',
        '    return `${this.a};`;',
        '  }',
        '  @IsString()',
        '  b!: string;',
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('FooDto.b');
    expect(res.stderr).not.toContain('FooDto.a');
  });

  describe('бейслайн', () => {
    const source = dto('  @IsString()', '  website?: string;');
    const key = 'src/foo/foo.dto.ts:FooDto.website';

    it('запись с честной причиной гасит поле — exit 0', () => {
      const res = foo(source, {
        [key]: 'Honeypot: любое непустое значение даёт 400, поле не хранится.',
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('исключений 1');
    });

    it('контрольный образец: другое поле той же записью не гасится — exit 1', () => {
      const res = foo(
        dto(
          '  @IsString()',
          '  website?: string;',
          '  @IsString()',
          '  name!: string;',
        ),
        {
          [key]:
            'Honeypot: любое непустое значение даёт 400, поле не хранится.',
        },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('FooDto.name');
      expect(res.stderr).not.toContain('FooDto.website');
    });

    it('причина короче 20 знаков — exit 1', () => {
      const res = foo(source, { [key]: 'legacy' });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('нет честной причины');
    });

    it('протухшая запись (у поля появилась граница) — exit 1', () => {
      const res = foo(
        dto('  @IsString()', '  @MaxLength(5)', '  website?: string;'),
        {
          [key]:
            'Honeypot: любое непустое значение даёт 400, поле не хранится.',
        },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('записи, которых в коде больше нет');
    });
  });
});

// Парсер scripts/dto-fields.mjs гоняем и напрямую: через песочницу гейта его
// не видит check-unwatched-code (в реальном коде тест должен назвать файл).
// jest здесь CommonJS и ESM-модуль не импортирует — запускаем настоящий
// модуль отдельным node-процессом, как это делает сам гейт.
type Member = {
  name: string | null;
  decorators: { name: string; args: string }[];
};
const parse = (source: string): { name: string; members: Member[] }[] => {
  const script =
    `import { parseClasses } from ${JSON.stringify(
      pathToFileURL(join(REAL_SCRIPTS_DIR, 'dto-fields.mjs')).href,
    )};` +
    'console.log(JSON.stringify(parseClasses(JSON.parse(process.argv[1]))));';
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script, JSON.stringify(source)],
    { encoding: 'utf8' },
  );
  return JSON.parse(out);
};

describe('dto-fields.mjs parseClasses', () => {
  it('собирает декораторы поля, в том числе многострочный @MaxLength и v.-префикс', () => {
    const [cls] = parse(
      [
        'export class FooDto {',
        '  @v.IsString()',
        '  @v.MaxLength(',
        '    LIMIT,',
        "    { message: 'длинно)' },",
        '  )',
        '  title?: string | null;',
        '}',
      ].join('\n'),
    );
    expect(cls.name).toBe('FooDto');
    const [title] = cls.members;
    expect(title.name).toBe('title');
    expect(title.decorators.map((d) => d.name)).toEqual([
      'IsString',
      'MaxLength',
    ]);
    // скобка внутри строки не обрывает аргументы декоратора
    expect(title.decorators[1].args).toContain("'длинно)'");
  });

  it('метод в теле класса — отдельный член без имени поля и не съедает соседей', () => {
    const [cls] = parse(
      [
        'class A {',
        '  @IsString() a!: string;',
        '  get label(): string { return `${this.a};`; }',
        '  @IsString() b!: string;',
        '}',
      ].join('\n'),
    );
    expect(cls.members.map((m) => m.name)).toEqual(['a', null, 'b']);
    expect(cls.members[2].decorators.map((d) => d.name)).toEqual(['IsString']);
  });
});
