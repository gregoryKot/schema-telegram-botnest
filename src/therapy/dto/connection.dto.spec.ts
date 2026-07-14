// DTO-рефактор inline-типов @Body() для подключения клиент↔терапевт
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  JoinTherapyDto,
  VirtualClientDto,
  AddClientDto,
} from './connection.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('JoinTherapyDto', () => {
  it('пустой код — отказ', async () => {
    await expect(errorsFor(JoinTherapyDto, { code: '' })).resolves.toContain(
      'code',
    );
  });
});

describe('VirtualClientDto', () => {
  it('имя не строка — отказ', async () => {
    await expect(errorsFor(VirtualClientDto, { name: 42 })).resolves.toContain(
      'name',
    );
  });
});

describe('AddClientDto', () => {
  it('clientTelegramId не число — отказ', async () => {
    await expect(
      errorsFor(AddClientDto, { clientTelegramId: 'not-a-number' }),
    ).resolves.toContain('clientTelegramId');
  });

  it('валидный id проходит', async () => {
    await expect(
      errorsFor(AddClientDto, { clientTelegramId: 123 }),
    ).resolves.toEqual([]);
  });
});
