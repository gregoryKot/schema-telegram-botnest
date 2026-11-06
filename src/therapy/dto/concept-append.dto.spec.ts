// DTO «дописать с холста» (#963, правило №6) и сверка с контрактом фронта
// (правило №4): поля ConceptAppendBody / ConceptAppendLink в
// shared/src/therapy/conceptAppend.ts = свойства DTO. Бэкенд shared не
// импортирует — контракт читается из файла (образец —
// therapy-invite-code.parity.spec.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { ConceptAppendDto, ConceptAppendLinkDto } from './concept-append.dto';

async function check(body: Record<string, unknown>) {
  const dto = plainToInstance(ConceptAppendDto, body);
  const errs = await validate(dto, { whitelist: true });
  return { dto, props: errs.map((e) => e.property) };
}

function dtoProps(cls: new () => object): string[] {
  const metas = getMetadataStorage().getTargetValidationMetadatas(
    cls,
    '',
    true,
    false,
  );
  return [...new Set(metas.map((m) => m.propertyName))].sort();
}

function contractProps(name: string): string[] {
  const src = readFileSync(
    join(__dirname, '../../../shared/src/therapy/conceptAppend.ts'),
    'utf8',
  );
  const body = new RegExp(`export interface ${name} \\{([^}]*)\\}`).exec(src);
  expect(body).not.toBeNull();
  return [...body![1].matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]).sort();
}

describe('ConceptAppendDto', () => {
  it('пустое тело проходит', async () => {
    await expect(check({})).resolves.toMatchObject({ props: [] });
  });

  it('лишнее режется: поля вне контракта и тексты внутри связи', async () => {
    const { dto, props } = await check({
      modeIds: ['punitive_critic'],
      goals: 'полное тело холст не шлёт',
      modeLinks: [
        { modeId: 'punitive_critic', schemaIds: ['shame'], alias: 'Судья' },
      ],
    });
    expect(props).toEqual([]);
    expect(dto).not.toHaveProperty('goals');
    expect(dto.modeLinks![0]).not.toHaveProperty('alias');
  });

  it('id длиннее 64 символов — отказ (и в списках, и в связи)', async () => {
    const long = 'x'.repeat(65);
    await expect(check({ modeIds: [long] })).resolves.toMatchObject({
      props: ['modeIds'],
    });
    await expect(check({ schemaIds: [long] })).resolves.toMatchObject({
      props: ['schemaIds'],
    });
    await expect(
      check({ modeLinks: [{ modeId: long, schemaIds: [] }] }),
    ).resolves.toMatchObject({ props: ['modeLinks'] });
    await expect(check({ modeIds: ['x'.repeat(64)] })).resolves.toMatchObject({
      props: [],
    });
  });

  it('больше 40 режимов или 20 схем у связи — отказ', async () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);
    await expect(check({ modeIds: ids(41) })).resolves.toMatchObject({
      props: ['modeIds'],
    });
    await expect(
      check({ modeLinks: [{ modeId: 'm', schemaIds: ids(21) }] }),
    ).resolves.toMatchObject({ props: ['modeLinks'] });
  });

  it('связь без schemaIds или с нестроковым id — отказ', async () => {
    await expect(
      check({ modeLinks: [{ modeId: 'm' }] }),
    ).resolves.toMatchObject({ props: ['modeLinks'] });
    await expect(check({ modeIds: [42] })).resolves.toMatchObject({
      props: ['modeIds'],
    });
  });

  it('сверка с контрактом фронта: ConceptAppendBody и ConceptAppendLink', () => {
    expect(dtoProps(ConceptAppendDto)).toEqual(
      contractProps('ConceptAppendBody'),
    );
    expect(dtoProps(ConceptAppendLinkDto)).toEqual(
      contractProps('ConceptAppendLink'),
    );
  });
});
