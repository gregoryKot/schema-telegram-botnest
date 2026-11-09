// DTO-рефактор мелких inline-типов @Body() в api.controller.ts
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateNameDto, InitDto, CheckinDto } from './misc.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('UpdateNameDto', () => {
  it('имя длиннее 50 — отказ', async () => {
    await expect(
      errorsFor(UpdateNameDto, { name: 'x'.repeat(51) }),
    ).resolves.toContain('name');
  });

  it('валидное имя проходит', async () => {
    await expect(errorsFor(UpdateNameDto, { name: 'Мария' })).resolves.toEqual(
      [],
    );
  });
});

describe('InitDto / CheckinDto', () => {
  it('InitDto без timezone проходит', async () => {
    await expect(errorsFor(InitDto, {})).resolves.toEqual([]);
  });

  it('InitDto: пояс устройства проходит, строка длиннее 64 — отказ', async () => {
    await expect(
      errorsFor(InitDto, { timezone: 'Asia/Vladivostok' }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(InitDto, { timezone: 'x'.repeat(65) }),
    ).resolves.toContain('timezone');
  });

  it('CheckinDto требует boolean done', async () => {
    await expect(errorsFor(CheckinDto, { done: true })).resolves.toEqual([]);
    await expect(errorsFor(CheckinDto, { done: 'yes' })).resolves.toContain(
      'done',
    );
  });
});
