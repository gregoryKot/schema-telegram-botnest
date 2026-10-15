// Тест гейта check-body-truncation.mjs (находка аудита 2026-10-11,
// backend#29): контроллер не режет поля запроса молча. Образец беды —
// `text: body.text.slice(0, 5000)` при DTO на 10 000: заметка на 6000 знаков
// отвечала 201 и теряла хвост.
//
// Сломанный гейт не краснеет — поэтому оба исхода: красный на срезе и
// зелёный на чистом дереве; и для каждого исключения (правило №15 п.2) —
// образец, который оно гасит, И контрольный похожий, который краснеет.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate } from './gate-sandbox';

const controller = (body: string) =>
  [
    "import { Controller, Post, Body } from '@nestjs/common';",
    '',
    "@Controller('foo')",
    'export class FooController {',
    '  @Post()',
    '  handle(@Body() body: FooDto) {',
    body,
    '  }',
    '}',
    '',
  ].join('\n');

const run = (files: Record<string, string>, baseline: object = {}) =>
  runGate('check-body-truncation.mjs', {
    'scripts/body-truncation-baseline.json': JSON.stringify(baseline),
    ...files,
  });

describe('check-body-truncation.mjs', () => {
  it('body.text.slice(0, 5000) в контроллере — exit 1, называет файл и строку', () => {
    const res = run({
      'src/foo.controller.ts': controller(
        '    const note = { text: body.text.slice(0, 5000) };',
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/foo.controller.ts:7');
    expect(res.stderr).toContain('body.text.slice(0, 5000)');
    expect(res.stderr).toContain('@MaxLength');
  });

  it.each([
    ['substring', '    const t = body.title.substring(0, 120);'],
    ['substr', '    const t = body.title.substr(0, 120);'],
    [
      'опциональная цепочка и константа',
      '    const t = body.title?.slice(0, LIMIT);',
    ],
    ['пробелы в аргументах', '    const t = body.title.slice( 0 , 200 );'],
  ])('%s — exit 1', (_name, line) => {
    const res = run({ 'src/foo.controller.ts': controller(line) });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/foo.controller.ts');
  });

  it('чистый контроллер, срез не с нуля, не-контроллер, спек и комментарий — exit 0', () => {
    const res = run({
      'src/foo.controller.ts': controller(
        [
          '    // раньше тут было body.text.slice(0, 5000) — хвост терялся молча',
          '    const tail = body.text.slice(5);',
          '    return this.service.save(body.text);',
        ].join('\n'),
      ),
      // Сервис — вне области гейта (усечение логов законно в сотне мест).
      'src/foo.service.ts': 'export const s = (x: string) => x.slice(0, 80);\n',
      'src/foo.controller.spec.ts': "const x = 'a'.slice(0, 1);\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт обрезки тела запроса');
  });

  describe('исключение из бейслайна', () => {
    const line = '    const day = result.exportedAt.slice(0, 10);';
    const key =
      'src/foo.controller.ts: const day = result.exportedAt.slice(0, 10);';
    const reason = 'Календарный день из ISO-момента для имени файла, не ввод.';

    it('запись с причиной гасит именно эту строку — exit 0', () => {
      const res = run(
        { 'src/foo.controller.ts': controller(line) },
        { [key]: reason },
      );
      expect(res.status).toBe(0);
    });

    it('контроль: похожая, но другая строка с той же формой по-прежнему краснеет', () => {
      const res = run(
        {
          'src/foo.controller.ts': controller(
            [line, '    const t = body.text.slice(0, 10);'].join('\n'),
          ),
        },
        { [key]: reason },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('body.text.slice(0, 10)');
      expect(res.stderr).not.toContain('exportedAt');
    });

    it('протухшая запись (строки в коде больше нет) — exit 1', () => {
      const res = run(
        { 'src/foo.controller.ts': controller('    return 1;') },
        { [key]: reason },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('которых в коде больше нет');
    });

    it('причина короче 20 знаков — exit 1', () => {
      const res = run(
        { 'src/foo.controller.ts': controller(line) },
        { [key]: 'легаси' },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('нет честной причины');
    });
  });

  it('настоящий бейслайн: каждая запись с содержательной причиной', () => {
    const real = JSON.parse(
      readFileSync(
        join(
          __dirname,
          '..',
          '..',
          '..',
          'scripts',
          'body-truncation-baseline.json',
        ),
        'utf8',
      ),
    ) as Record<string, string>;
    for (const [key, why] of Object.entries(real)) {
      expect({ key, ok: why.trim().length >= 20 }).toEqual({ key, ok: true });
    }
  });
});
