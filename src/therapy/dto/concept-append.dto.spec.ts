// DTO «дописать с холста» (#963, правило №6) и сверка с контрактом фронта
// (правило №4): поля ConceptAppendBody / ConceptAppendLink /
// ConceptAppendSchemaLink в shared/src/therapy/conceptAppend.ts = свойства DTO. Бэкенд shared не
// импортирует — контракт читается из файла (образец —
// therapy-invite-code.parity.spec.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { ConceptAppendDto } from './concept-append.dto';
import {
  ConceptAppendLinkDto,
  ConceptAppendSchemaLinkDto,
} from './concept-append-links.dto';
import { NEED_IDS } from '../../bot/bot.service';

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
  // interface (поле на строке) или однострочный type-алиас (поля через «;»).
  const body = new RegExp(
    `export (?:interface ${name}|type ${name} =) \\{([^}]*)\\}`,
  ).exec(src);
  expect(body).not.toBeNull();
  return [...body![1].matchAll(/(?:^|[;\n])\s*(\w+)\??:/g)]
    .map((m) => m[1])
    .sort();
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

  it('сверка с контрактом фронта: ConceptAppendBody, ConceptAppendLink, ConceptAppendSchemaLink', () => {
    expect(dtoProps(ConceptAppendDto)).toEqual(
      contractProps('ConceptAppendBody'),
    );
    expect(dtoProps(ConceptAppendLinkDto)).toEqual(
      contractProps('ConceptAppendLink'),
    );
    expect(dtoProps(ConceptAppendSchemaLinkDto)).toEqual(
      contractProps('ConceptAppendSchemaLink'),
    );
    // Контрольный образец: парсер контракта видит все поля, а не первое.
    expect(contractProps('ConceptAppendSchemaLink')).toEqual([
      'needIds',
      'schemaId',
    ]);
    expect(contractProps('ConceptAppendBody')).toHaveLength(4);
  });
});

// Колесо потребностей: «✓» режим → потребность и «✗» схема → потребность.
describe('ConceptAppendDto — потребности', () => {
  // Правило №4: холст шлёт id из NEED_ORDER сайта, DTO пускает NEED_IDS
  // бэкенда — списки обязаны совпадать, иначе линия к потребности ловит 400.
  it('NEED_IDS бэкенда = NEED_ORDER сайта (shared/src/needs/types.ts)', () => {
    const src = readFileSync(
      join(__dirname, '../../../shared/src/needs/types.ts'),
      'utf8',
    );
    const list = /export const NEED_ORDER = \[([^\]]*)\]/.exec(src);
    expect(list).not.toBeNull();
    const order = [...list![1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(order).toEqual([...NEED_IDS]);
  });

  it('валидное тело: needIds у связи режима и schemaLinks проходят', async () => {
    await expect(
      check({
        modeLinks: [
          { modeId: 'healthy_adult', schemaIds: [], needIds: ['play'] },
        ],
        schemaLinks: [
          { schemaId: 'defectiveness', needIds: ['attachment', 'limits'] },
        ],
      }),
    ).resolves.toMatchObject({ props: [] });
  });

  it('неизвестная потребность — отказ (и у режима, и у схемы)', async () => {
    await expect(
      check({
        modeLinks: [{ modeId: 'm', schemaIds: [], needIds: ['safety'] }],
      }),
    ).resolves.toMatchObject({ props: ['modeLinks'] });
    await expect(
      check({ schemaLinks: [{ schemaId: 's', needIds: ['safety'] }] }),
    ).resolves.toMatchObject({ props: ['schemaLinks'] });
  });

  it('больше пяти потребностей, schemaId длиннее 64, нет needIds — отказ', async () => {
    const six = [
      'attachment',
      'autonomy',
      'expression',
      'play',
      'limits',
      'play',
    ];
    await expect(
      check({ schemaLinks: [{ schemaId: 's', needIds: six }] }),
    ).resolves.toMatchObject({ props: ['schemaLinks'] });
    await expect(
      check({ schemaLinks: [{ schemaId: 'x'.repeat(65), needIds: [] }] }),
    ).resolves.toMatchObject({ props: ['schemaLinks'] });
    await expect(
      check({ schemaLinks: [{ schemaId: 's' }] }),
    ).resolves.toMatchObject({ props: ['schemaLinks'] });
    await expect(
      check({ schemaLinks: [{ schemaId: 'x'.repeat(64), needIds: [] }] }),
    ).resolves.toMatchObject({ props: [] });
  });

  it('больше 40 записей схем — отказ', async () => {
    const links = Array.from({ length: 41 }, (_, i) => ({
      schemaId: `s${i}`,
      needIds: ['play'],
    }));
    await expect(check({ schemaLinks: links })).resolves.toMatchObject({
      props: ['schemaLinks'],
    });
    await expect(
      check({ schemaLinks: links.slice(0, 40) }),
    ).resolves.toMatchObject({ props: [] });
  });

  it('лишние поля внутри schemaLinks режутся whitelist-ом', async () => {
    const { dto, props } = await check({
      schemaLinks: [
        {
          schemaId: 'defectiveness',
          needIds: ['attachment'],
          belief: 'холст текст не пишет',
          origin: 'и это тоже',
        },
      ],
    });
    expect(props).toEqual([]);
    expect(dto.schemaLinks![0]).toEqual({
      schemaId: 'defectiveness',
      needIds: ['attachment'],
    });
    expect(dto.schemaLinks![0]).not.toHaveProperty('belief');
  });
});
