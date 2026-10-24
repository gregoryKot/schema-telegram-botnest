// Гейт реестра экспорта (правило №4 CLAUDE.md, право на переносимость).
// По образцу src/auth/table-registry.spec.ts: не ищем признак, а требуем
// классификации КАЖДОЙ модели с userId (то же множество, что там —
// USER_DATA_TABLES ∪ {AuthProvider, WebSession, TherapistRequest}). Плюс
// сверка со вторым реестром (FIELD_POLICY, src/utils/encryption-policy.ts):
// набор полей, которые export-policy решает расшифровывать, обязан точно
// совпадать с enc-полями модели — иначе поле либо утечёт зашифрованным
// (забыли добавить в schema), либо в schema появится поле, которого больше
// нет в модели (протухло).
import { readFileSync } from 'fs';
import { join } from 'path';
import { USER_DATA_TABLES } from '../bot/account.service';
import {
  EXPORT_POLICY,
  USER_EXPORT_SELECT,
  WITHHELD_USER_FIELDS,
  assertSyncedWithEncryptionPolicy,
} from './export-policy';
import { FIELD_POLICY } from '../utils/encryption-policy';

const ROOT = join(__dirname, '..', '..');
const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');

function modelsWithField(fieldRe: RegExp): string[] {
  const out: string[] = [];
  const modelRe = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema)) !== null) {
    if (fieldRe.test(m[2])) out.push(m[1]);
  }
  return out;
}
const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

// То же множество, что auth/table-registry.spec.ts проверяет как «модели с
// userId»: USER_DATA_TABLES ∪ AuthProvider/WebSession/TherapistRequest
// (обрабатываются отдельно от общего реестра в delete/merge, но userId у них
// есть — этот спек классифицирует их так же, как остальные).
const USER_ID_MODELS = modelsWithField(/^\s*userId\s+BigInt\??\s/m);

describe('Реестр экспорта данных ↔ schema.prisma / FIELD_POLICY', () => {
  it('sanity: парсер находит модели с userId', () => {
    expect(USER_ID_MODELS.length).toBeGreaterThanOrEqual(20);
  });

  it('каждая модель с userId классифицирована (export либо withhold)', () => {
    const missing = USER_ID_MODELS.filter((m) => !EXPORT_POLICY[m]);
    // Новая таблица с userId → реши осознанно: экспортировать (с указанием,
    // какие enc-поля расшифровывать) или withhold (с причиной, не короче
    // ~20 символов) в src/account/export-policy.ts.
    expect(missing).toEqual([]);
  });

  it('в реестре нет протухших записей (модель исчезла из schema.prisma)', () => {
    const stale = Object.keys(EXPORT_POLICY).filter(
      (m) => !USER_ID_MODELS.includes(m),
    );
    expect(stale).toEqual([]);
  });

  it('реестр покрывает ровно то же множество моделей, что и delete-реестр (USER_DATA_TABLES + AuthProvider/WebSession/TherapistRequest)', () => {
    const delModels = new Set([
      ...USER_DATA_TABLES.map(capitalize),
      'AuthProvider',
      'WebSession',
      'TherapistRequest',
    ]);
    const expModels = new Set(Object.keys(EXPORT_POLICY));
    const onlyDelete = [...delModels].filter((m) => !expModels.has(m));
    const onlyExport = [...expModels].filter((m) => !delModels.has(m));
    expect({ onlyDelete, onlyExport }).toEqual({
      onlyDelete: [],
      onlyExport: [],
    });
  });

  it('withhold-записи имеют внятную причину (не отписку)', () => {
    const vague = Object.entries(EXPORT_POLICY)
      .filter(([, d]) => d.status === 'withhold')
      .filter(([, d]) => {
        const reason = (d as { reason: string }).reason;
        return (
          reason.length < 20 || /^(legacy|потом|todo)/i.test(reason.trim())
        );
      })
      .map(([m]) => m);
    expect(vague).toEqual([]);
  });

  // ── Сверка со вторым реестром (FIELD_POLICY) — правило №4 ─────────────────
  it('поля, которые export-policy расшифровывает, — ровно enc-поля модели по FIELD_POLICY', () => {
    const mismatches: string[] = [];
    for (const [model, decision] of Object.entries(EXPORT_POLICY)) {
      if (decision.status !== 'export') continue;
      const declared = new Set([
        ...(decision.schema?.strings ?? []),
        ...(decision.schema?.jsonArrays ?? []),
      ]);
      const encFields = new Set(
        Object.entries(FIELD_POLICY[model] ?? {})
          .filter(([, p]) => 'enc' in p)
          .map(([f]) => f),
      );
      const missingFromSchema = [...encFields].filter((f) => !declared.has(f));
      const extraInSchema = [...declared].filter((f) => !encFields.has(f));
      if (missingFromSchema.length || extraInSchema.length) {
        mismatches.push(
          `${model}: забыто в export-schema=[${missingFromSchema.join(', ')}] ` +
            `лишнее=[${extraInSchema.join(', ')}]`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// Второй разрез того же принципа: реестр моделей выше не видит ПОЛЕЙ самого
// субъекта. Список USER_EXPORT_SELECT перечислен вручную и безопасен по
// умолчанию (новая колонка не попадёт в файл), но ровно поэтому новая обычная
// настройка молча не доедет до человека — а узнает он об этом, только когда
// недосчитается своих данных. Поэтому поля тоже требуют классификации.
describe('Поля User: каждое либо в выгрузке, либо withhold с причиной', () => {
  // Скалярные колонки модели User: relation-поля (тип — другая модель) и
  // списки отсекаем, они выгружаются отдельными таблицами.
  const userScalars = (() => {
    const body = /model\s+User\s+\{([\s\S]*?)\n\}/.exec(schema)![1];
    const known =
      /^(BigInt|String|Int|Boolean|DateTime|Json|Float|Decimal|Bytes|UserRole)$/;
    return [...body.matchAll(/^\s{2}(\w+)\s+(\w+)(\[\])?\??\s/gm)]
      .filter((m) => !m[3] && known.test(m[2]))
      .map((m) => m[1]);
  })();

  it('sanity: парсер находит скалярные поля User', () => {
    expect(userScalars.length).toBeGreaterThanOrEqual(40);
    expect(userScalars).toContain('addressForm');
    expect(userScalars).toContain('totpSecret');
  });

  it('каждое скалярное поле классифицировано', () => {
    const unclassified = userScalars.filter(
      (f) => !(f in USER_EXPORT_SELECT) && !(f in WITHHELD_USER_FIELDS),
    );
    // Сообщение важнее ассерта: следующий автор должен понять, что делать.
    expect({
      unclassified,
      подсказка:
        'новая колонка User: внеси в USER_EXPORT_SELECT (человек увидит её ' +
        'в выгрузке) либо в WITHHELD_USER_FIELDS с причиной, почему не отдаём',
    }).toEqual({ unclassified: [], подсказка: expect.any(String) });
  });

  it('секреты второго фактора не попали в выгрузку по недосмотру', () => {
    for (const secret of ['totpSecret', 'totpRecoveryCodes']) {
      expect(secret in USER_EXPORT_SELECT).toBe(false);
      expect(WITHHELD_USER_FIELDS[secret]).toEqual(expect.any(String));
    }
  });

  it('нет протухших записей: withhold-поле исчезло из схемы', () => {
    const stale = Object.keys(WITHHELD_USER_FIELDS).filter(
      (f) => !userScalars.includes(f),
    );
    expect(stale).toEqual([]);
  });

  it('у каждого withhold-поля внятная причина, а не отписка', () => {
    const vague = Object.entries(WITHHELD_USER_FIELDS)
      .filter(
        ([, why]) => why.trim().length < 20 || /^(legacy|потом)/i.test(why),
      )
      .map(([f]) => f);
    expect(vague).toEqual([]);
  });
});

// Рантайм-проверка перед выдачей: если поле шифруется, но export-policy его не
// расшифровывает, человек получит в файле нечитаемую строку, похожую на
// данные. Проверяем ОБА исхода — молчит на согласованном реестре и падает на
// рассинхроне, иначе тест не доказывает, что защита вообще работает.
describe('assertSyncedWithEncryptionPolicy', () => {
  it('на текущем реестре молчит', () => {
    expect(() => assertSyncedWithEncryptionPolicy()).not.toThrow();
  });

  it('падает и называет поле, если enc-поле перестали расшифровывать', () => {
    const saved = EXPORT_POLICY.UserLetter;
    EXPORT_POLICY.UserLetter = { status: 'export' }; // забыли schema
    try {
      expect(() => assertSyncedWithEncryptionPolicy()).toThrow(
        /UserLetter\.text/,
      );
    } finally {
      EXPORT_POLICY.UserLetter = saved;
    }
  });
});
