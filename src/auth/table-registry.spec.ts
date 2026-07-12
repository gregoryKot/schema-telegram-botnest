// Сверка реестров user-таблиц со schema.prisma (аудит 2026-07, находка S-2).
//
// Три места обязаны покрывать одни и те же модели:
//   1. schema.prisma — источник правды (модели с полем userId)
//   2. USER_DATA_TABLES (bot.service) — deleteAllUserData / right-to-erasure
//   3. USER_OWNED_TABLES + SECURITY_SENSITIVE_TABLES (merge.service) — merge аккаунтов
//
// До этого spec'а списки жили независимо, и дрейф уже случился: EmailToken был
// в delete-реестре, но не в merge (сироты после merge), а ModeMap /
// TherapistCustomMode вообще не переносились при merge — карты режимов
// терапевта терялись. Новая модель с userId, забытая в любом списке,
// теперь роняет этот тест.
import { readFileSync } from 'fs';
import { join } from 'path';
import { USER_DATA_TABLES } from '../bot/bot.service';
import { USER_OWNED_TABLES, SECURITY_SENSITIVE_TABLES } from './merge.service';

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

// Модели с колонкой userId (BigInt / BigInt?). userId1/userId2 (Pair) сюда
// не попадают — у Pair отдельная обработка в обоих сервисах.
const USER_ID_MODELS = modelsWithField(/^\s*userId\s+BigInt\??\s/m);

// Модели therapist-стороны (therapistId/clientId) — не имеют userId,
// обрабатываются вручную и в deleteAllUserData, и в merge().
const THERAPIST_SIDE_MODELS = modelsWithField(/^\s*therapistId\s+BigInt\??\s/m);

describe('Реестры user-таблиц ↔ schema.prisma', () => {
  it('sanity: парсер schema.prisma находит модели', () => {
    expect(USER_ID_MODELS.length).toBeGreaterThanOrEqual(20);
    expect(THERAPIST_SIDE_MODELS).toEqual(
      expect.arrayContaining(['TherapyRelation', 'TherapistNote']),
    );
  });

  it('каждая модель с userId покрыта удалением аккаунта (USER_DATA_TABLES или явный deleteMany)', () => {
    // Обрабатываются отдельными deleteMany в deleteAllUserData, а не через
    // реестр (проверено тестом bot.delete-user-data.spec.ts).
    const DELETE_HANDLED_SEPARATELY = [
      'AuthProvider',
      'WebSession',
      'TherapistRequest',
    ];
    const covered = new Set([
      ...USER_DATA_TABLES.map(capitalize),
      ...DELETE_HANDLED_SEPARATELY,
    ]);
    const missing = USER_ID_MODELS.filter((m) => !covered.has(m));
    expect(missing).toEqual([]); // забыл внести модель в USER_DATA_TABLES (bot.service.ts)
  });

  it('каждая модель с userId покрыта merge-переносом (USER_OWNED или SECURITY_SENSITIVE)', () => {
    const covered = new Set<string>([
      ...USER_OWNED_TABLES,
      ...SECURITY_SENSITIVE_TABLES,
    ]);
    const missing = USER_ID_MODELS.filter((m) => !covered.has(m));
    expect(missing).toEqual([]); // забыл внести модель в merge.service.ts — при merge данные потеряются
  });

  it('therapist-side модели упомянуты и в deleteAllUserData, и в merge()', () => {
    // Трипваер: у этих моделей нет userId, реестры их не ловят — проверяем,
    // что имя модели фигурирует в исходнике обоих сервисов.
    const botSrc = readFileSync(join(ROOT, 'src/bot/bot.service.ts'), 'utf8');
    const mergeSrc = readFileSync(
      join(ROOT, 'src/auth/merge.service.ts'),
      'utf8',
    );
    for (const model of THERAPIST_SIDE_MODELS) {
      const camel = model[0].toLowerCase() + model.slice(1);
      expect(botSrc.includes(`${camel}.deleteMany`)).toBe(true);
      expect(mergeSrc.includes(`"${model}"`)).toBe(true);
    }
  });

  it('реестр удаления и merge-реестр покрывают одинаковое множество userId-моделей', () => {
    const del = new Set([
      ...USER_DATA_TABLES.map(capitalize),
      'AuthProvider',
      'WebSession',
      'TherapistRequest',
    ]);
    const mrg = new Set<string>([
      ...USER_OWNED_TABLES,
      ...SECURITY_SENSITIVE_TABLES,
    ]);
    const onlyDelete = [...del].filter((t) => !mrg.has(t));
    const onlyMerge = [...mrg].filter((t) => !del.has(t));
    expect({ onlyDelete, onlyMerge }).toEqual({
      onlyDelete: [],
      onlyMerge: [],
    });
  });
});
