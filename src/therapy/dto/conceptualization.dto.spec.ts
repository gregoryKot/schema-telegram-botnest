// DTO-рефактор inline-типа @Body() для карты концептуализации
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConceptualizationDto } from './conceptualization.dto';
import {
  CONCEPT_FIELD_TEXT_MAX,
  CONCEPT_MODE_TEXT_MAX,
  CONCEPT_SCHEMA_TEXT_MAX,
} from '../../utils/text-limits';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(ConceptualizationDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('ConceptualizationDto', () => {
  it('пустое тело проходит (все поля опциональны)', async () => {
    await expect(errorsFor({})).resolves.toEqual([]);
  });

  // Предел — та же константа, что `maxLength` полей вида «Поля» на обоих
  // фронтах (shared/src/limits/textLimits.ts, сверка — text-limits.parity.spec.ts).
  // Инцидент 2026-10-26: у полей предела не было, текст длиннее молча
  // не сохранялся и блокировал сохранение остальных полей.
  it.each([
    'earlyExperience',
    'unmetNeeds',
    'triggers',
    'copingStyles',
    'goals',
    'currentProblems',
    'modeTransitions',
  ])(
    `текстовое поле %s длиннее ${CONCEPT_FIELD_TEXT_MAX} — отказ, ровно ${CONCEPT_FIELD_TEXT_MAX} — проходит`,
    async (field) => {
      await expect(
        errorsFor({ [field]: 'x'.repeat(CONCEPT_FIELD_TEXT_MAX + 1) }),
      ).resolves.toContain(field);
      await expect(
        errorsFor({ [field]: 'x'.repeat(CONCEPT_FIELD_TEXT_MAX) }),
      ).resolves.toEqual([]);
    },
  );

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

  describe('modeLinks (графическая концептуализация)', () => {
    const link = (over: Record<string, unknown> = {}) => ({
      modeId: 'punitive_critic',
      alias: 'Судья',
      schemaIds: ['defectiveness'],
      needIds: ['safety'],
      origin: 'Голос отца',
      manifest: 'Откладывает дела',
      strategy: 'Ограничить влияние',
      ...over,
    });

    it('валидная связь проходит', async () => {
      await expect(errorsFor({ modeLinks: [link()] })).resolves.toEqual([]);
    });

    it('связь только с modeId проходит (остальное опционально)', async () => {
      await expect(
        errorsFor({ modeLinks: [{ modeId: 'vulnerable_child' }] }),
      ).resolves.toEqual([]);
    });

    it('ровно 40 связей проходят, 41 — отказ', async () => {
      const many = (n: number) =>
        Array.from({ length: n }, (_, i) => link({ modeId: `m${i}` }));
      await expect(errorsFor({ modeLinks: many(40) })).resolves.toEqual([]);
      await expect(errorsFor({ modeLinks: many(41) })).resolves.toContain(
        'modeLinks',
      );
    });

    it.each(['origin', 'manifest', 'strategy'])(
      `текст %s длиннее ${CONCEPT_MODE_TEXT_MAX} — отказ, ровно ${CONCEPT_MODE_TEXT_MAX} — проходит`,
      async (field) => {
        const at = 'x'.repeat(CONCEPT_MODE_TEXT_MAX);
        await expect(
          errorsFor({ modeLinks: [link({ [field]: at })] }),
        ).resolves.toEqual([]);
        await expect(
          errorsFor({ modeLinks: [link({ [field]: `${at}x` })] }),
        ).resolves.toContain('modeLinks');
      },
    );

    it('alias длиннее 80 — отказ, ровно 80 — проходит', async () => {
      await expect(
        errorsFor({ modeLinks: [link({ alias: 'x'.repeat(80) })] }),
      ).resolves.toEqual([]);
      await expect(
        errorsFor({ modeLinks: [link({ alias: 'x'.repeat(81) })] }),
      ).resolves.toContain('modeLinks');
    });

    it('связь без modeId — отказ', async () => {
      const { modeId: _omit, ...noId } = link();
      await expect(errorsFor({ modeLinks: [noId] })).resolves.toContain(
        'modeLinks',
      );
    });

    it('modeId длиннее 64 — отказ', async () => {
      await expect(
        errorsFor({ modeLinks: [link({ modeId: 'x'.repeat(65) })] }),
      ).resolves.toContain('modeLinks');
    });

    it('schemaIds/needIds: больше 20 id и id длиннее 64 — отказ', async () => {
      const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);
      await expect(
        errorsFor({ modeLinks: [link({ schemaIds: ids(21) })] }),
      ).resolves.toContain('modeLinks');
      await expect(
        errorsFor({ modeLinks: [link({ needIds: ids(21) })] }),
      ).resolves.toContain('modeLinks');
      await expect(
        errorsFor({ modeLinks: [link({ needIds: ['x'.repeat(65)] })] }),
      ).resolves.toContain('modeLinks');
      await expect(
        errorsFor({ modeLinks: [link({ schemaIds: ids(20) })] }),
      ).resolves.toEqual([]);
    });

    it('modeLinks не массив / элемент не объект — отказ', async () => {
      await expect(errorsFor({ modeLinks: 'x' })).resolves.toContain(
        'modeLinks',
      );
      await expect(errorsFor({ modeLinks: ['x'] })).resolves.toContain(
        'modeLinks',
      );
    });

    it('лишнее поле внутри связи вырезается whitelist-ом', async () => {
      const dto = plainToInstance(ConceptualizationDto, {
        modeLinks: [link({ clientId: '555', note: 'лишнее' })],
      });
      const errs = await validate(dto, { whitelist: true });
      expect(errs).toEqual([]);
      const kept = dto.modeLinks![0] as unknown as Record<string, unknown>;
      expect(kept).not.toHaveProperty('clientId');
      expect(kept).not.toHaveProperty('note');
      expect(kept.alias).toBe('Судья');
    });
  });

  describe('schemaLinks (тексты схем графической концептуализации)', () => {
    const link = (over: Record<string, unknown> = {}) => ({
      schemaId: 'defectiveness',
      belief: 'Со мной что-то не так',
      origin: 'Мать сравнивала с сестрой',
      needIds: ['safety', 'autonomy'],
      ...over,
    });

    it('валидная связь проходит', async () => {
      await expect(errorsFor({ schemaLinks: [link()] })).resolves.toEqual([]);
    });

    it('связь только со schemaId проходит (остальное опционально)', async () => {
      await expect(
        errorsFor({ schemaLinks: [{ schemaId: 'abandonment' }] }),
      ).resolves.toEqual([]);
    });

    it('ровно 20 связей проходят, 21 — отказ', async () => {
      const many = (n: number) =>
        Array.from({ length: n }, (_, i) => link({ schemaId: `s${i}` }));
      await expect(errorsFor({ schemaLinks: many(20) })).resolves.toEqual([]);
      await expect(errorsFor({ schemaLinks: many(21) })).resolves.toContain(
        'schemaLinks',
      );
    });

    it.each(['belief', 'origin'])(
      `текст %s длиннее ${CONCEPT_SCHEMA_TEXT_MAX} — отказ, ровно ${CONCEPT_SCHEMA_TEXT_MAX} — проходит`,
      async (field) => {
        const at = 'x'.repeat(CONCEPT_SCHEMA_TEXT_MAX);
        await expect(
          errorsFor({ schemaLinks: [link({ [field]: at })] }),
        ).resolves.toEqual([]);
        await expect(
          errorsFor({ schemaLinks: [link({ [field]: `${at}x` })] }),
        ).resolves.toContain('schemaLinks');
      },
    );

    it('needIds: ровно 5 проходят, 6 — отказ, id длиннее 64 — отказ', async () => {
      const ids = (n: number) => Array.from({ length: n }, (_, i) => `n${i}`);
      await expect(
        errorsFor({ schemaLinks: [link({ needIds: ids(5) })] }),
      ).resolves.toEqual([]);
      await expect(
        errorsFor({ schemaLinks: [link({ needIds: ids(6) })] }),
      ).resolves.toContain('schemaLinks');
      await expect(
        errorsFor({ schemaLinks: [link({ needIds: ['x'.repeat(65)] })] }),
      ).resolves.toContain('schemaLinks');
    });

    it('связь без schemaId — отказ', async () => {
      const { schemaId: _omit, ...noId } = link();
      await expect(errorsFor({ schemaLinks: [noId] })).resolves.toContain(
        'schemaLinks',
      );
    });

    it('schemaId длиннее 64 — отказ', async () => {
      await expect(
        errorsFor({ schemaLinks: [link({ schemaId: 'x'.repeat(65) })] }),
      ).resolves.toContain('schemaLinks');
    });

    it('schemaLinks не массив / элемент не объект — отказ', async () => {
      await expect(errorsFor({ schemaLinks: 'x' })).resolves.toContain(
        'schemaLinks',
      );
      await expect(errorsFor({ schemaLinks: ['x'] })).resolves.toContain(
        'schemaLinks',
      );
    });

    it('лишнее поле внутри связи вырезается whitelist-ом', async () => {
      const dto = plainToInstance(ConceptualizationDto, {
        schemaLinks: [link({ clientId: '555', note: 'лишнее' })],
      });
      const errs = await validate(dto, { whitelist: true });
      expect(errs).toEqual([]);
      const kept = dto.schemaLinks![0] as unknown as Record<string, unknown>;
      expect(kept).not.toHaveProperty('clientId');
      expect(kept).not.toHaveProperty('note');
      expect(kept.belief).toBe('Со мной что-то не так');
    });
  });
});
