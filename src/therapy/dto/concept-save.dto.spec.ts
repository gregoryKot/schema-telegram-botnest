// Худшее тело сохранения концептуализации против потолка тела запроса
// (docs/open/therapy.md: «Предельная концептуализация упрётся в потолок тела
// запроса», «Отметки "Делали сегодня": предел не сверен с лимитом тела»).
// Полное тело с 40 связями режимов и 20 связями схем, заполненными до предела,
// больше 256 КБ при любом числе отметок — поэтому сайт шлёт патч, а здесь
// сверяется худший ПАТЧ: все поля до предела, списки до потолка и по
// CONCEPT_PATCH_LINKS_MAX связей каждого вида с отметками до
// CONCEPT_TECHNIQUE_MARKS_MAX. Текст — кириллицей (2 байта на знак в UTF-8),
// как пересчёт в src/infra/body-limit.ts. Спек проверяет обе стороны: тело
// проходит DTO (значит, оно правда на пределе, а не меньше) и меньше потолка.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConceptSaveDto } from './concept-save.dto';
import { BODY_LIMIT_BYTES } from '../../infra/body-limit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CONCEPT_PATCH_LINKS_MAX } from './concept-save.dto';
import { CONCEPT_TECHNIQUE_MARKS_MAX } from '../../utils/text-limits';
import {
  cyrIds,
  worstFullBody,
  worstModeLink,
  worstPatchBody,
} from '../../test-support/concept-worst-body';

async function errorsFor(body: object): Promise<string[]> {
  const errs = await validate(plainToInstance(ConceptSaveDto, body), {
    whitelist: true,
  });
  return errs.map((e) => e.property);
}

const bytes = (body: object) => Buffer.byteLength(JSON.stringify(body));

describe('ConceptSaveDto — худшее тело против потолка тела запроса', () => {
  it('худший патч проходит DTO — он правда на пределе', async () => {
    await expect(errorsFor(worstPatchBody())).resolves.toEqual([]);
  });

  it('худший патч меньше BODY_LIMIT_BYTES', () => {
    expect(bytes(worstPatchBody())).toBeLessThan(BODY_LIMIT_BYTES);
  });

  it('связей сверх CONCEPT_PATCH_LINKS_MAX в одном запросе — отказ', async () => {
    await expect(
      errorsFor(worstPatchBody(CONCEPT_PATCH_LINKS_MAX + 1)),
    ).resolves.toEqual(
      expect.arrayContaining(['modeLinksPatch', 'schemaLinksPatch']),
    );
  });

  it('отметок сверх CONCEPT_TECHNIQUE_MARKS_MAX у связи — отказ', async () => {
    const body = {
      modeLinksPatch: {
        upsert: [worstModeLink(0, CONCEPT_TECHNIQUE_MARKS_MAX + 1)],
      },
    };
    await expect(errorsFor(body)).resolves.toContain('modeLinksPatch');
  });

  it('контроль: полное тело на пределе больше потолка — потому и патч', async () => {
    const full = worstFullBody();
    await expect(errorsFor(full)).resolves.toEqual([]);
    expect(bytes(full)).toBeGreaterThan(BODY_LIMIT_BYTES);
  });

  // Правило №4: сайт режет патч по своей копии предела (бэкенд shared не
  // импортирует) — разъедутся, и часть сохранения получит 400.
  it('предел связей в запросе совпадает с зеркалом сайта (shared conceptPatch.ts)', () => {
    const shared = readFileSync(
      join(
        __dirname,
        '../../../shared/src/therapy/conceptGraph/conceptPatch.ts',
      ),
      'utf8',
    );
    const m = /export const CONCEPT_PATCH_LINKS_MAX = (\d+);/.exec(shared);
    expect(Number(m?.[1])).toBe(CONCEPT_PATCH_LINKS_MAX);
  });

  it('baseVersion: ISO-момент или null; мусор — отказ', async () => {
    await expect(errorsFor({ baseVersion: null })).resolves.toEqual([]);
    await expect(errorsFor({ baseVersion: 'вчера' })).resolves.toContain(
      'baseVersion',
    );
  });

  it('списки id: схем не больше 40, режимов не больше 100', async () => {
    await expect(errorsFor({ schemaIds: cyrIds('s', 41) })).resolves.toContain(
      'schemaIds',
    );
    await expect(errorsFor({ modeIds: cyrIds('m', 101) })).resolves.toContain(
      'modeIds',
    );
  });
});
