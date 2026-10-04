// Гейт реестра выгрузки для моделей с ключом clientId (A-10, аудит 2026-10).
// Парный к export-policy.spec.ts (тот — для userId-моделей): без него модели
// терапевтической стороны оставались невидимыми для гейта, и файл выгрузки
// молча «забывал» данные о человеке. Здесь та же схема: полная классификация,
// явный список колонок, сверка с реестром шифрования — и оба исхода у
// рантайм-проверки.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CLIENT_EXPORT_POLICY,
  assertClientExportSynced,
} from './export-policy.client';
import { FIELD_POLICY } from '../utils/encryption-policy';

const schemaText = readFileSync(
  join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
);

// Модели с BigInt-колонкой clientId и все их скалярные колонки.
function clientIdModels(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const modelRe = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  const scalar =
    /^(BigInt|String|Int|Boolean|DateTime|Json|Float|Decimal|Bytes|RelationStatus)$/;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schemaText)) !== null) {
    if (!/^\s*clientId\s+BigInt\??\s/m.test(m[2])) continue;
    out[m[1]] = [...m[2].matchAll(/^\s{2}(\w+)\s+(\w+)(\[\])?\??\s/gm)]
      .filter((f) => !f[3] && scalar.test(f[2]))
      .map((f) => f[1]);
  }
  return out;
}

const MODELS = clientIdModels();

describe('Реестр выгрузки для clientId-моделей ↔ schema.prisma / FIELD_POLICY', () => {
  it('sanity: парсер находит модели с clientId', () => {
    expect(Object.keys(MODELS)).toEqual(
      expect.arrayContaining(['ModeMap', 'TherapyRelation', 'TherapistNote']),
    );
  });

  it('каждая модель с clientId классифицирована (export либо withhold)', () => {
    const missing = Object.keys(MODELS).filter((m) => !CLIENT_EXPORT_POLICY[m]);
    // Новая модель терапевтической стороны → реши осознанно: отдавать ли
    // человеку данные о нём самом (export + список колонок) или withhold с причиной.
    expect(missing).toEqual([]);
  });

  it('нет протухших записей (модель исчезла из schema.prisma)', () => {
    const stale = Object.keys(CLIENT_EXPORT_POLICY).filter((m) => !MODELS[m]);
    expect(stale).toEqual([]);
  });

  it('у export-модели каждая колонка либо в select, либо в omit с причиной — ровно одно из двух', () => {
    const problems: string[] = [];
    for (const [model, d] of Object.entries(CLIENT_EXPORT_POLICY)) {
      if (d.status !== 'export') continue;
      for (const col of MODELS[model] ?? []) {
        const inSel = col in d.select;
        const inOmit = col in d.omit;
        if (inSel === inOmit)
          problems.push(
            `${model}.${col}: ${inSel ? 'и в select, и в omit' : 'не классифицирована'}`,
          );
      }
      for (const [col, why] of Object.entries(d.omit))
        if (why.trim().length < 20) problems.push(`${model}.${col}: причина`);
      for (const col of [...Object.keys(d.select), ...Object.keys(d.omit)])
        if (!MODELS[model]?.includes(col))
          problems.push(`${model}.${col}: колонки нет в схеме`);
    }
    expect(problems).toEqual([]);
  });

  it('withhold-записи имеют внятную причину', () => {
    for (const d of Object.values(CLIENT_EXPORT_POLICY))
      if (d.status === 'withhold') expect(d.reason.length).toBeGreaterThan(20);
  });

  it('записи психолога (заметки, концептуализация) остаются withhold', () => {
    expect(CLIENT_EXPORT_POLICY.TherapistNote.status).toBe('withhold');
    expect(CLIENT_EXPORT_POLICY.ClientConceptualization.status).toBe(
      'withhold',
    );
  });

  // Пометка терапевта о клиенте принадлежит терапевту, а не человеку.
  it('личные пометки терапевта и код приглашения не уходят в файл', () => {
    const rel = CLIENT_EXPORT_POLICY.TherapyRelation;
    if (rel.status !== 'export') throw new Error('TherapyRelation: export');
    for (const col of ['clientAlias', 'virtualClientName', 'code'])
      expect(rel.select).not.toHaveProperty(col);
  });

  it('enc-поля, которые уходят в файл, расшифровываются — ровно те, что по FIELD_POLICY', () => {
    for (const [model, d] of Object.entries(CLIENT_EXPORT_POLICY)) {
      if (d.status !== 'export') continue;
      const declared = [
        ...(d.schema?.strings ?? []),
        ...(d.schema?.jsonArrays ?? []),
      ].sort();
      const encSelected = Object.entries(FIELD_POLICY[model] ?? {})
        .filter(([f, p]) => 'enc' in p && f in d.select)
        .map(([f]) => f)
        .sort();
      expect({ model, declared }).toEqual({ model, declared: encSelected });
    }
  });
});

describe('assertClientExportSynced', () => {
  it('на текущем реестре молчит', () => {
    expect(() => assertClientExportSynced()).not.toThrow();
  });

  it('падает и называет поле, если enc-поле уходит в файл без расшифровки', () => {
    const saved = CLIENT_EXPORT_POLICY.ModeMap;
    if (saved.status !== 'export') throw new Error('ModeMap: export');
    CLIENT_EXPORT_POLICY.ModeMap = { ...saved, schema: undefined };
    try {
      expect(() => assertClientExportSynced()).toThrow(/ModeMap\.title/);
    } finally {
      CLIENT_EXPORT_POLICY.ModeMap = saved;
    }
  });
});
