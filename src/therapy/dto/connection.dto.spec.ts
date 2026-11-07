// DTO-рефактор inline-типов @Body() для подключения клиент↔терапевт
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CLIENT_NAME_MAX } from '../../utils/text-limits';
import { RenameClientDto } from './client-data.dto';
import { JoinTherapyDto } from './connection.dto';
import { VirtualClientDto } from './virtual-client.dto';
import { CreateInviteDto } from './invite.dto';

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

describe('JoinTherapyDto — длина кода (T5)', () => {
  it('код длиннее 32 символов — отказ; обычный 12-символьный проходит', async () => {
    await expect(
      errorsFor(JoinTherapyDto, { code: 'A'.repeat(33) }),
    ).resolves.toContain('code');
    await expect(
      errorsFor(JoinTherapyDto, { code: 'AABBCCDDEEFF' }),
    ).resolves.toEqual([]);
  });
});

describe('VirtualClientDto', () => {
  it('имя не строка — отказ', async () => {
    await expect(errorsFor(VirtualClientDto, { name: 42 })).resolves.toContain(
      'name',
    );
  });

  // Аудит 2026-10-11: имя было `@IsString()` без границы, тело — до 256 КБ.
  it('имя длиннее CLIENT_NAME_MAX — отказ, ровно по пределу проходит', async () => {
    await expect(
      errorsFor(VirtualClientDto, { name: 'A'.repeat(CLIENT_NAME_MAX + 1) }),
    ).resolves.toContain('name');
    await expect(
      errorsFor(VirtualClientDto, { name: 'A'.repeat(CLIENT_NAME_MAX) }),
    ).resolves.toEqual([]);
  });

  it('предел имени офлайн-клиента совпадает с пределом переименования', async () => {
    const tooLong = 'A'.repeat(CLIENT_NAME_MAX + 1);
    await expect(
      errorsFor(RenameClientDto, { alias: tooLong }),
    ).resolves.toContain('alias');
    await expect(
      errorsFor(RenameClientDto, { alias: 'A'.repeat(CLIENT_NAME_MAX) }),
    ).resolves.toEqual([]);
  });
});

describe('CreateInviteDto — имя клиента в приглашении (инцидент 2026-10-26)', () => {
  it('без тела и без имени — можно (приглашение из настроек «Кабинет»)', async () => {
    await expect(errorsFor(CreateInviteDto, {})).resolves.toEqual([]);
  });

  it('имя в пределе CLIENT_NAME_MAX проходит, длиннее — отказ, не строка — отказ', async () => {
    await expect(
      errorsFor(CreateInviteDto, { alias: 'М'.repeat(CLIENT_NAME_MAX) }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(CreateInviteDto, { alias: 'М'.repeat(CLIENT_NAME_MAX + 1) }),
    ).resolves.toContain('alias');
    await expect(errorsFor(CreateInviteDto, { alias: 42 })).resolves.toContain(
      'alias',
    );
  });
});
