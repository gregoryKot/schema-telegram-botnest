// DTO-рефактор inline-типов @Body() для карт режимов и кастомных режимов
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CustomModeDto,
  CreateModeMapDto,
  UpdateModeMapDto,
} from './mode-maps.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('CustomModeDto / CreateModeMapDto — слабые поля-строки', () => {
  it('пустое тело проходит', async () => {
    await expect(errorsFor(CustomModeDto, {})).resolves.toEqual([]);
    await expect(errorsFor(CreateModeMapDto, {})).resolves.toEqual([]);
  });

  it('неизвестный nodeType/kind не отклоняется (сервис фолбэкает на дефолт)', async () => {
    await expect(
      errorsFor(CustomModeDto, { name: 'Мой режим', nodeType: 'unknown' }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(CreateModeMapDto, { kind: 'unknown' }),
    ).resolves.toEqual([]);
  });
});

describe('UpdateModeMapDto', () => {
  it('nodes больше 200 — отказ', async () => {
    const nodes = Array.from({ length: 201 }, (_, i) => ({ id: i }));
    await expect(errorsFor(UpdateModeMapDto, { nodes })).resolves.toContain(
      'nodes',
    );
  });

  it('edges больше 500 — отказ', async () => {
    const edges = Array.from({ length: 501 }, (_, i) => ({ id: i }));
    await expect(errorsFor(UpdateModeMapDto, { edges })).resolves.toContain(
      'edges',
    );
  });
});
