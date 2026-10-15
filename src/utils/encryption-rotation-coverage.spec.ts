// Сверка (правило №4): список ротации ENCRYPTION_KEY ↔ реестр шифрования ↔
// схема Prisma — по ПАРЕ (модель, поле), а не по имени поля.
//
// Рунбук (CLAUDE.md, «Ротация ENCRYPTION_KEY») добавляет второй ключ, гоняет
// ротацию, затем УДАЛЯЕТ старый. Поле, пропущенное ротацией, превращается в
// нерасшифровываемый мусор без ошибки. Прежняя версия этого спека искала имя
// поля в ТЕКСТЕ скрипта, и аудит 2026-10-11 нашёл три дыры такой проверки:
//   - `origins`/`healthyView` «покрыты» записью userSchemaNote, хотя у
//     UserModeNote их в списке не было (имя совпало, пара — нет);
//   - `answers` (YSQ) шифруется присваиванием и обнаружению не виден вовсе;
//   - `pk` не сверялся со схемой: userSafePlace (ключ userId) и diaryDraft
//     (составной ключ) стояли без верного pk, и ротация падала на седьмой
//     модели из 27.
// Теперь источник правды — FIELD_POLICY (enc) и schema.prisma, а не текст.
import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import { RotationTarget, TARGETS } from '../cli/rotate-encryption/targets';
import { pkColumns } from '../cli/rotate-encryption/rotate-all';
import { FIELD_POLICY, Policy } from './encryption-policy';

interface ModelInfo {
  fields: Record<string, string>; // поле → тип Prisma
  pk: string[];
}

const ROOT = join(__dirname, '..', '..');
const schemaText = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');

// Первичные ключи: рантайм-DMMF клиента Prisma 7 их не отдаёт (в нём только
// имя/вид/тип поля), поэтому ключ читается из schema.prisma — `@id` на поле или
// `@@id([a, b])` на модели.
function primaryKeys(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of schemaText.matchAll(/model\s+(\w+)\s+\{([\s\S]*?)\n\}/g)) {
    const body = m[2];
    const composite = /@@id\(\[([^\]]+)\]/.exec(body);
    if (composite) {
      out[m[1]] = composite[1].split(',').map((c) => c.trim());
      continue;
    }
    const single = /^\s*(\w+)\s+\S+.*@id\b/m.exec(body);
    if (single) out[m[1]] = [single[1]];
  }
  return out;
}

function realModels(): Record<string, ModelInfo> {
  const pks = primaryKeys();
  const out: Record<string, ModelInfo> = {};
  for (const m of Prisma.dmmf.datamodel.models) {
    out[m.name] = {
      fields: Object.fromEntries(m.fields.map((f) => [f.name, f.type])),
      pk: pks[m.name] ?? [],
    };
  }
  return out;
}

// Чистая сверка — отдельной функцией, чтобы её можно было проверить на
// синтетических реестрах (контрольные образцы ниже, правило №15 п.2).
export function findRotationProblems(
  targets: RotationTarget[],
  policy: Record<string, Record<string, Policy>>,
  models: Record<string, ModelInfo>,
): string[] {
  const problems: string[] = [];
  const covered = new Set<string>();
  const seen = new Set<string>();
  for (const t of targets) {
    const model = t.name[0].toUpperCase() + t.name.slice(1);
    if (seen.has(t.name))
      problems.push(`${t.name}: запись списка продублирована`);
    seen.add(t.name);
    const info = models[model];
    if (!info) {
      problems.push(`${t.name}: в схеме нет модели ${model}`);
      continue;
    }
    const pk = pkColumns(t);
    if ([...pk].sort().join() !== [...info.pk].sort().join())
      problems.push(
        `${t.name}: pk [${pk.join(',')}] не совпадает с ключом схемы [${info.pk.join(',')}]`,
      );
    for (const f of t.fields) {
      covered.add(`${model}.${f}`);
      if (!['String', 'Json'].includes(info.fields[f]))
        problems.push(
          `${t.name}.${f}: нет в схеме String/Json-поля с таким именем`,
        );
      else if (!('enc' in (policy[model]?.[f] ?? {})))
        problems.push(
          `${t.name}.${f}: протухшая запись — в реестре шифрования поле не enc`,
        );
    }
  }
  for (const [model, fields] of Object.entries(policy))
    for (const [f, p] of Object.entries(fields))
      if ('enc' in p && !covered.has(`${model}.${f}`))
        problems.push(
          `${model}.${f}: зашифровано, но ротация его не перешифровывает`,
        );
  return problems.sort();
}

describe('покрытие ротации ENCRYPTION_KEY: список ↔ реестр шифрования ↔ схема', () => {
  const models = realModels();

  it('санити: ключи схемы разобраны (одиночный, составной, нестандартный)', () => {
    expect(models.Note.pk).toEqual(['id']);
    expect(models.UserSafePlace.pk).toEqual(['userId']);
    expect(models.DiaryDraft.pk).toEqual(['userId', 'type']);
    expect(models.ClientMeeting.pk).toEqual(['clientKey']);
    const withoutPk = Object.entries(models).filter(
      ([, m]) => m.pk.length === 0,
    );
    expect(withoutPk.map(([n]) => n)).toEqual([]);
  });

  it('санити: в реестре достаточно enc-полей, проверка не пустая', () => {
    const enc = Object.values(FIELD_POLICY).flatMap((m) =>
      Object.values(m).filter((p) => 'enc' in p),
    );
    expect(enc.length).toBeGreaterThan(90);
  });

  it('список ротации и реестр шифрования совпадают по парам (модель, поле); pk — как в схеме', () => {
    expect(findRotationProblems(TARGETS, FIELD_POLICY, models)).toEqual([]);
  });

  it('вложенная история концептуализаций ротируется отдельным шагом, а не списком', () => {
    // history — plain-контейнер: чувствительные поля внутри шифруются попольно.
    expect('enc' in FIELD_POLICY.ClientConceptualization.history).toBe(false);
    expect(TARGETS.some((t) => t.fields.includes('history'))).toBe(false);
  });

  describe('контрольные образцы: сверка краснеет там, где обязана', () => {
    const policy: Record<string, Record<string, Policy>> = {
      UserModeNote: {
        origins: { enc: 'x' },
        modeId: { plain: 'ключ' },
      },
      DiaryDraft: { data: { enc: 'x' } },
    };
    const info: Record<string, ModelInfo> = {
      UserModeNote: {
        fields: { origins: 'String', modeId: 'String', id: 'Int' },
        pk: ['id'],
      },
      DiaryDraft: {
        fields: { data: 'Json', userId: 'BigInt', type: 'String' },
        pk: ['userId', 'type'],
      },
    };
    const good: RotationTarget[] = [
      { name: 'userModeNote', fields: ['origins'] },
      { name: 'diaryDraft', fields: ['data'], pk: ['userId', 'type'] },
    ];

    it('согласованный набор — без замечаний', () => {
      expect(findRotationProblems(good, policy, info)).toEqual([]);
    });

    it('пара, убранная из списка, краснеет (а имя поля у другой модели не спасает)', () => {
      const withoutPair = [
        good[1],
        { name: 'userSchemaNote', fields: ['origins'] },
      ];
      const infoPlus = {
        ...info,
        UserSchemaNote: { fields: { origins: 'String' }, pk: ['id'] },
      };
      const problems = findRotationProblems(withoutPair, policy, infoPlus);
      expect(problems).toContain(
        'UserModeNote.origins: зашифровано, но ротация его не перешифровывает',
      );
    });

    it('неверный pk краснеет: дефолтный id у модели с составным ключом', () => {
      const problems = findRotationProblems(
        [good[0], { name: 'diaryDraft', fields: ['data'] }],
        policy,
        info,
      );
      expect(problems).toEqual([
        'diaryDraft: pk [id] не совпадает с ключом схемы [userId,type]',
      ]);
    });

    it('запись про несуществующее поле, не-enc поле и несуществующую модель краснеет', () => {
      const problems = findRotationProblems(
        [
          ...good,
          { name: 'userModeNote', fields: ['origins', 'ghost', 'modeId'] },
          { name: 'noSuchModel', fields: ['x'] },
        ],
        policy,
        info,
      );
      expect(problems).toEqual(
        [
          'noSuchModel: в схеме нет модели NoSuchModel',
          'userModeNote.ghost: нет в схеме String/Json-поля с таким именем',
          'userModeNote.modeId: протухшая запись — в реестре шифрования поле не enc',
          'userModeNote: запись списка продублирована',
        ].sort(),
      );
    });
  });
});
