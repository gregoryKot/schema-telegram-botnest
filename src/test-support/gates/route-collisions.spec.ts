// Тест гейта check-route-collisions.mjs — детектор двух контроллеров,
// регистрирующих один и тот же HTTP-маршрут (реальный инцидент: второй
// контроллер отвечал молча и терял privacy-проверку). Без бейслайна —
// гейт жёсткий, чистый прогон должен быть zero-tolerance.
import { runGate } from './gate-sandbox';

const CONTROLLER = (className: string, ctrlPath: string, getPath: string) =>
  [
    "import { Controller, Get } from '@nestjs/common';",
    '',
    `@Controller('${ctrlPath}')`,
    `export class ${className} {`,
    `  @Get('${getPath}')`,
    `  handle() {}`,
    '}',
    '',
  ].join('\n');

describe('check-route-collisions.mjs', () => {
  it('два контроллера с одним и тем же методом+путём (после нормализации :param) — exit 1', () => {
    const res = runGate('check-route-collisions.mjs', {
      // :id и :key — оба нормализуются в :*, поэтому это один и тот же слот.
      'src/foo.controller.ts': CONTROLLER('FooController', 'foo', ':id'),
      'src/foo2.controller.ts': CONTROLLER('Foo2Controller', 'foo', ':key'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('маршрут-дубль: GET /foo/:*');
    expect(res.stderr).toContain('src/foo.controller.ts');
    expect(res.stderr).toContain('src/foo2.controller.ts');
  });

  it('уникальные маршруты в разных контроллерах — exit 0', () => {
    const res = runGate('check-route-collisions.mjs', {
      'src/bar.controller.ts': CONTROLLER('BarController', 'bar', ''),
      'src/baz.controller.ts': CONTROLLER('BazController', 'baz', ''),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ коллизий маршрутов нет (2 маршрутов)');
  });

  // До этого теста фикстуры проверяли только @Get — Post/Put/Patch/Delete
  // не были покрыты ни одним тестом (замер: сузить регэксп до одного @Get
  // ни один тест не ловил).
  it('два контроллера с одним и тем же POST-маршрутом — тоже exit 1', () => {
    const POST_CONTROLLER = (className: string, ctrlPath: string) =>
      [
        "import { Controller, Post } from '@nestjs/common';",
        '',
        `@Controller('${ctrlPath}')`,
        `export class ${className} {`,
        '  @Post()',
        '  handle() {}',
        '}',
        '',
      ].join('\n');
    const res = runGate('check-route-collisions.mjs', {
      'src/foo.controller.ts': POST_CONTROLLER('FooController', 'donate'),
      'src/foo2.controller.ts': POST_CONTROLLER('Foo2Controller', 'donate'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('маршрут-дубль: POST /donate');
  });
});
