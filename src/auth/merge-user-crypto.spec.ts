// Сверка реестров (правило №4): FIELD_POLICY.User (что шифруется) ↔
// USER_MERGE_RULES (что слияние переносит). Поле, которое в колонке лежит
// шифротекстом и которое слияние переносит, обязано проходить расшифровку —
// иначе правило видит две base64-строки вместо значений и молча ничего не
// переносит (backend#0, аудит 2026-10-11: «мои схемы/режимы» пропадали после
// «Привязать Telegram»). Проверяется ПОВЕДЕНИЕМ: для каждого такого поля
// слияние гоняется на настоящих шифротекстах, а не на plaintext-фикстуре.
//
// ENCRYPTION_KEY — до импорта crypto (ключ читается при загрузке модуля).
process.env.ENCRYPTION_KEY = 'cd'.repeat(32);

import { decrypt, decryptJson, encrypt, encryptJson } from '../utils/crypto';
import { FIELD_POLICY } from '../utils/encryption-policy';
import { mergeUserScalarFields } from './merge-user-fields';
import { mergeEncryptSchema } from './merge-user-lists';
import {
  MERGED_USER_FIELDS,
  USER_MERGE_RULES,
  mergedValue,
} from './merge-user-rules';

const SRC = BigInt(1);
const TGT = BigInt(2);

/** enc-поля User, которые слияние переносит (правило не `skip`). */
const encMerged = Object.entries(FIELD_POLICY.User)
  .filter(([f, p]) => 'enc' in p && MERGED_USER_FIELDS.includes(f))
  .map(([f]) => f);

function runMerge(src: Record<string, unknown>, tgt: Record<string, unknown>) {
  const rows: Record<string, Record<string, unknown>> = { 1: src, 2: tgt };
  const update = jest.fn().mockResolvedValue({});
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ re: null, rev: null }]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    user: {
      findUnique: jest.fn(({ where }: { where: { id: bigint } }) =>
        Promise.resolve(rows[String(where.id)]),
      ),
      update,
    },
    userSchemaNote: { findMany: jest.fn().mockResolvedValue([]) },
    userModeNote: { findMany: jest.fn().mockResolvedValue([]) },
  } as never;
  return mergeUserScalarFields(tx, SRC, TGT).then(
    () => (update.mock.calls[0]?.[0]?.data ?? {}) as Record<string, unknown>,
  );
}

describe('Слияние User ↔ шифрование полей (FIELD_POLICY)', () => {
  it('sanity: «мои схемы/режимы» — enc и переносятся; второй фактор — enc, но skip', () => {
    expect(encMerged).toEqual(
      expect.arrayContaining(['mySchemaIds', 'myModeIds']),
    );
    for (const f of ['totpSecret', 'totpRecoveryCodes']) {
      expect('enc' in FIELD_POLICY.User[f]).toBe(true);
      expect(USER_MERGE_RULES[f].kind).toBe('skip');
      // skip-поле слияние не расшифровывает и не пишет.
      const s = mergeEncryptSchema();
      expect([...(s.jsonArrays ?? []), ...(s.strings ?? [])]).not.toContain(f);
    }
  });

  it.each(encMerged)(
    'enc-поле %s проходит расшифровку в слиянии (по поведению, на шифротексте)',
    async (field) => {
      const kind = USER_MERGE_RULES[field].kind;
      if (kind === 'union') {
        const data = await runMerge(
          { [field]: encryptJson(['from-source']) },
          { [field]: encryptJson(['in-target']) },
        );
        expect(decryptJson<string[]>(data[field] as string)).toEqual([
          'in-target',
          'from-source',
        ]);
      } else if (kind === 'fillEmpty') {
        const data = await runMerge(
          { [field]: encrypt('secret') },
          { [field]: null },
        );
        expect(decrypt(data[field] as string)).toBe('secret');
      } else {
        // Правило, смысла которого для шифротекста нет (флаг, приватность,
        // дефолт): новое enc-поле с таким правилом — повод решить, как его
        // сливать, а не молча ставить сравнение шифротекстов.
        throw new Error(
          `${field}: enc-поле с правилом «${kind}» — добавь проверку расшифровки`,
        );
      }
    },
  );

  it('контроль: без расшифровки union по шифротекстам отдавал бы undefined (класс backend#0)', () => {
    // Что делал код до починки: правило получало строки. Если этот контроль
    // перестанет быть правдой, тест выше перестал что-либо доказывать.
    expect(
      mergedValue({ kind: 'union' }, encryptJson(['a']), encryptJson(['b'])),
    ).toBeUndefined();
  });
});
