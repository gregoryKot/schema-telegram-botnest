// DTO-рефактор inline-типа @Body() для пары (join/leave)
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PairCodeDto } from './pairs.dto';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(PairCodeDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('PairCodeDto', () => {
  it('валидный код проходит', async () => {
    await expect(errorsFor({ code: 'ABC123' })).resolves.toEqual([]);
  });

  it('пустой код — отказ', async () => {
    await expect(errorsFor({ code: '' })).resolves.toContain('code');
  });

  it('отсутствующий код — отказ', async () => {
    await expect(errorsFor({})).resolves.toContain('code');
  });
});
