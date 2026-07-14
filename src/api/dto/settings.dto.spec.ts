// DTO-рефактор inline-типа @Body() для POST /api/settings
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSettingsDto } from './settings.dto';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(UpdateSettingsDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('UpdateSettingsDto', () => {
  it('пустое тело проходит (все поля опциональны)', async () => {
    await expect(errorsFor({})).resolves.toEqual([]);
  });

  it('валидный полный набор проходит', async () => {
    await expect(
      errorsFor({
        notifyEnabled: true,
        notifyLocalHour: 21,
        notifyTimezone: 'Europe/Moscow',
        notifyFrequency: 2,
        notifyQuietStart: 22,
        notifyQuietEnd: 8,
        addressForm: 'vy',
        mySchemaIds: ['abandonment', 'mistrust'],
      }),
    ).resolves.toEqual([]);
  });

  it('час вне 0–23 — отказ', async () => {
    await expect(errorsFor({ notifyLocalHour: 24 })).resolves.toContain(
      'notifyLocalHour',
    );
  });

  it('незнакомая таймзона — отказ', async () => {
    await expect(errorsFor({ notifyTimezone: 'Mars/Base' })).resolves.toContain(
      'notifyTimezone',
    );
  });

  it('addressForm вне ty/vy — отказ', async () => {
    await expect(errorsFor({ addressForm: 'plural' })).resolves.toContain(
      'addressForm',
    );
  });

  it('notifyPausedUntil принимает только null', async () => {
    await expect(errorsFor({ notifyPausedUntil: null })).resolves.toEqual([]);
    await expect(
      errorsFor({ notifyPausedUntil: '2026-07-14' }),
    ).resolves.toContain('notifyPausedUntil');
  });

  it('mySchemaIds длиннее 200 — отказ', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `s${i}`);
    await expect(errorsFor({ mySchemaIds: ids })).resolves.toContain(
      'mySchemaIds',
    );
  });
});
