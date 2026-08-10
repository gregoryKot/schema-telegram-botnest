// Тест гейта check-body-dto.mjs (правило №6 CLAUDE.md: новый эндпоинт = DTO
// с class-validator). ValidationPipe({ whitelist: true }) валидирует тело
// запроса через декораторы РЕФЛЕКСИЕЙ класса — у interface/type/Record их в
// рантайме нет, и Nest молча пропускает тело без единой проверки. Найдено
// аудитом: 8 таких мест, включая два публичных денежных эндпоинта
// (donation, subscription) — DTO там были компиляторной иллюзией.
import { runGate } from './gate-sandbox';

describe('check-body-dto.mjs', () => {
  it('@Body() dto: SomeInterface (interface, не класс) — exit 1, называет контроллер и тип', () => {
    const res = runGate('check-body-dto.mjs', {
      'scripts/body-dto-baseline.json': '{}',
      'src/foo.controller.ts': [
        "import { Controller, Post, Body } from '@nestjs/common';",
        '',
        'interface FooDto {',
        '  amount: number;',
        '}',
        '',
        "@Controller('foo')",
        'export class FooController {',
        '  @Post()',
        '  handle(@Body() dto: FooDto) {}',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/foo.controller.ts');
    expect(res.stderr).toContain('FooDto');
  });

  it('@Body() dto: SomeDto, где SomeDto — export class — exit 0', () => {
    const res = runGate('check-body-dto.mjs', {
      'scripts/body-dto-baseline.json': '{}',
      'src/foo.controller.ts': [
        "import { Controller, Post, Body } from '@nestjs/common';",
        '',
        'export class FooDto {',
        '  amount: number;',
        '}',
        '',
        "@Controller('foo')",
        'export class FooController {',
        '  @Post()',
        '  handle(@Body() dto: FooDto) {}',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт DTO у @Body(): 1 параметров, 1 — class-DTO, 0 известных исключений.');
  });

  it('нарушение занесено в бейслайн с причиной — exit 0', () => {
    const res = runGate('check-body-dto.mjs', {
      'scripts/body-dto-baseline.json': JSON.stringify({
        'src/foo.controller.ts:FooDto':
          'зафиксировано осознанно для теста гейта — причина длиннее 20 символов',
      }),
      'src/foo.controller.ts': [
        "import { Controller, Post, Body } from '@nestjs/common';",
        '',
        'interface FooDto {',
        '  amount: number;',
        '}',
        '',
        "@Controller('foo')",
        'export class FooController {',
        '  @Post()',
        '  handle(@Body() dto: FooDto) {}',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 известных исключений');
  });

  it('запись бейслайна протухла (нарушения больше нет) — exit 1', () => {
    const res = runGate('check-body-dto.mjs', {
      // Бейслайн ссылается на FooDto, но в дереве FooDto теперь класс —
      // нарушения фактически нет, запись протухла.
      'scripts/body-dto-baseline.json': JSON.stringify({
        'src/foo.controller.ts:FooDto': 'старая причина, но нарушение уже исправлено',
      }),
      'src/foo.controller.ts': [
        "import { Controller, Post, Body } from '@nestjs/common';",
        '',
        'export class FooDto {',
        '  amount: number;',
        '}',
        '',
        "@Controller('foo')",
        'export class FooController {',
        '  @Post()',
        '  handle(@Body() dto: FooDto) {}',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухли');
    expect(res.stderr).toContain('src/foo.controller.ts:FooDto');
  });

  it('@Body(\'field\') — ключеванный body, гейт не срабатывает', () => {
    const res = runGate('check-body-dto.mjs', {
      'scripts/body-dto-baseline.json': '{}',
      'src/foo.controller.ts': [
        "import { Controller, Post, Body } from '@nestjs/common';",
        '',
        "@Controller('foo')",
        'export class FooController {',
        '  @Post()',
        "  handle(@Body('email') email: string) {}",
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('0 параметров');
  });
});
