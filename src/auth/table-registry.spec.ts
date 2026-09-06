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
import { USER_DATA_TABLES } from '../bot/account.service';
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
    // реестр (проверено тестом account.service.spec.ts).
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
    // Транзакция удаления живёт отдельным файлом (правило №10), реестр —
    // третьим: трипваер читает оба, иначе после выноса он молча позеленел бы
    // на пустом месте.
    const botSrc =
      readFileSync(join(ROOT, 'src/bot/account.delete.ts'), 'utf8') +
      readFileSync(join(ROOT, 'src/bot/account.service.ts'), 'utf8');
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

// ─── Классификация ВСЕХ моделей схемы ───────────────────────────────────────
//
// Проверки выше ищут модели по колонке `userId`/`therapistId` — и именно
// поэтому пропустили Subscription (аудит 2026-09): она привязана к
// `telegramId`, а значит для гейта её просто не существовало. Удаление
// аккаунта этот перекос знало и обрабатывало вручную, merge — нет, и связать
// два места было нечем.
//
// Поэтому логика перевёрнута: не «проверяем модели с userId», а «КАЖДАЯ
// модель схемы обязана быть классифицирована». Новая модель с любой осью
// привязки больше не проскочит молча — она уронит этот тест как
// неклассифицированная (правило №4 и правило №15 CLAUDE.md).
const OTHER_MODELS: Record<string, string> = {
  User: 'сам субъект данных: удаляется последним в deleteAllUserData, при merge — источник',
  Pair: 'две ссылки userId1/userId2 без колонки userId — отдельные UPDATE/DELETE в merge и deleteAllUserData',
  Subscription:
    'привязана по telegramId (оформляют из Telegram без веб-аккаунта): удаление — account.delete.ts по двум id, merge — merge-subscriptions.ts',
  SubscriptionCharge:
    'история списаний, каскад onDelete от Subscription — отдельной привязки к пользователю нет',
  // Честно: это персональные данные ВНЕ контура удаления аккаунта. Формы
  // публичные (записаться и пожертвовать можно без входа), связи с User нет,
  // поэтому автоматически удалить их при удалении аккаунта нельзя. Это
  // известное ограничение, а не «инфраструктурная таблица» — маскировать
  // формулировкой запрещено (правило №15).
  Donation:
    'ДОЛГ: email плательщика вне контура удаления аккаунта — пожертвование анонимно, связи с User нет, удаление только по запросу вручную',
  Booking:
    'ДОЛГ: контакт и свободный текст запроса вне контура удаления аккаунта — запись публичная, без авторизации, удаление по запросу вручную',
  ClientMeeting:
    'ДОЛГ: clientKey = sha256(контакта) вне контура удаления аккаунта — встреча заводится от записи, связи с User нет',
  AvailabilityRule:
    'расписание терапевта, настройка кабинета — не данные пользователя',
  BookingSetting: 'настройки цен и слотов, админская конфигурация',
  Article: 'контент сайта, автор — владелец проекта',
  HealthyAdultPhrase: 'пул фраз канала «Здоровый Взрослый», контент',
  HealthyAdultPost: 'журнал публикаций канала, контент',
  ChannelDelivery: 'журнал доставок в площадки канала, инфраструктура',
  CronLease:
    'аренда прогона крона между инстансами: имя расписания, время и имя процесса — инфраструктура, пользователя в строке нет',
};

describe('Классификация моделей: ни одна не остаётся невидимой', () => {
  const ALL_MODELS = [...schema.matchAll(/model\s+(\w+)\s+\{/g)].map(
    (m) => m[1],
  );
  const covered = new Set([...USER_ID_MODELS, ...THERAPIST_SIDE_MODELS]);

  it('каждая модель схемы либо покрыта по userId/therapistId, либо описана в OTHER_MODELS', () => {
    const unclassified = ALL_MODELS.filter(
      (m) => !covered.has(m) && !(m in OTHER_MODELS),
    );
    // Сообщение важнее ассерта: следующий автор должен понять, что делать.
    expect({
      unclassified,
      подсказка:
        'классифицируй модель: покрой удалением+merge (колонка userId) ' +
        'или добавь в OTHER_MODELS причину, где и как она обрабатывается',
    }).toEqual({ unclassified: [], подсказка: expect.any(String) });
  });

  it('в OTHER_MODELS нет протухших записей (модель удалена или обрела userId)', () => {
    const stale = Object.keys(OTHER_MODELS).filter(
      (m) => !ALL_MODELS.includes(m) || covered.has(m),
    );
    expect(stale).toEqual([]);
  });

  it('у каждой записи OTHER_MODELS есть внятная причина', () => {
    const vague = Object.entries(OTHER_MODELS)
      .filter(
        ([, why]) => why.trim().length < 20 || /^(legacy|потом)/i.test(why),
      )
      .map(([m]) => m);
    expect(vague).toEqual([]);
  });
});
