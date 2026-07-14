// DTO-рефактор inline-типа @Body() для карты концептуализации
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConceptualizationDto } from './conceptualization.dto';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(ConceptualizationDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('ConceptualizationDto', () => {
  it('пустое тело проходит (все поля опциональны)', async () => {
    await expect(errorsFor({})).resolves.toEqual([]);
  });

  it('текстовое поле длиннее 5000 — отказ', async () => {
    await expect(
      errorsFor({ earlyExperience: 'x'.repeat(5001) }),
    ).resolves.toContain('earlyExperience');
  });

  it('id в schemaIds длиннее 64 — отказ', async () => {
    await expect(errorsFor({ schemaIds: ['x'.repeat(65)] })).resolves.toContain(
      'schemaIds',
    );
  });

  it('modeMapNodes больше 200 — отказ', async () => {
    const modeMapNodes = Array.from({ length: 201 }, (_, i) => ({ id: i }));
    await expect(errorsFor({ modeMapNodes })).resolves.toContain(
      'modeMapNodes',
    );
  });

  it('modeMapEdges больше 500 — отказ', async () => {
    const modeMapEdges = Array.from({ length: 501 }, (_, i) => ({ id: i }));
    await expect(errorsFor({ modeMapEdges })).resolves.toContain(
      'modeMapEdges',
    );
  });
});
