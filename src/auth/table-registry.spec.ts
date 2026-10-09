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
  // Решение владельца 2026-10-08 (находка L3 аудита 2026-07-20): не удаление
  // по аккаунту, а ретенция по сроку. Привязки к аккаунту у брони нет вовсе —
  // clientTelegramId с C-9 не записывается, форма записи публичная, — поэтому
  // «удалять вместе с аккаунтом» нечем, а ретенция покрывает ВСЕ брони.
  Booking:
    'ретенция по сроку (решение 2026-10-08): имя, контакт и текст запроса затирает крон через 12 месяцев после сессии (booking-retention.service.ts), факт записи — дата, тип, согласие с офертой — остаётся; легаси clientTelegramId при удалении аккаунта обнуляется (account.delete.ts)',
  ClientMeeting:
    'ДОЛГ: clientKey = sha256(контакта) вне контура удаления аккаунта — встреча заводится от записи, связи с User нет',
  AvailabilityRule:
    'расписание терапевта, настройка кабинета — не данные пользователя',
  SlotOverride:
    'ручной слой поверх AvailabilityRule (BLOCK/OPEN отдельных слотов) — та же настройка кабинета, не данные пользователя',
  BookingSetting: 'настройки цен и слотов, админская конфигурация',
  Article: 'контент сайта, автор — владелец проекта',
  HealthyAdultPhrase: 'пул фраз канала «Здоровый Взрослый», контент',
  HealthyAdultPost: 'журнал публикаций канала, контент',
  ChannelDelivery: 'журнал доставок в площадки канала, инфраструктура',
  CronLease:
    'аренда прогона крона между инстансами: имя расписания, время и имя процесса — инфраструктура, пользователя в строке нет',
  ThrottleHit:
    'счётчик троттлинга (инцидент 2026-09-13): key — sha256 маршрута+бакета, не данные пользователя, инфраструктура',
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

// ─── Вторичные ссылки на человека: BigInt-колонка мимо `userId` ─────────────
//
// В этой схеме `BigInt` означает ровно одно: идентификатор человека (ключи
// остальных моделей — `Int @default(autoincrement())`). А проверки выше
// смотрят только на `userId` и на пару `therapistId`/`clientId` — колонка, где
// человек стоит под ДРУГИМ именем, для них не существует. Так жил
// `Subscription.telegramId` (аудит 2026-09), и так же жили две оси билета
// входа (находка L3 аудита 2026-07-20): `shownToTelegramId` не чистил никто, а
// `approvedUserId` переназначался при слиянии, но не удалялся вместе с
// аккаунтом.
//
// Поэтому гейт требует КЛАССИФИКАЦИИ, а не ищет признак (правило №17): гейт,
// ищущий признак, молчит о том, чего не знает. Каждая BigInt-колонка мимо
// `userId` обязана стоять здесь с объяснением, кто её обрабатывает при
// удалении и при слиянии. Новая такая колонка роняет тест.
const PERSON_REF_COLUMNS: Record<string, string> = {
  'Booking.clientTelegramId':
    'удаление — обнуляется в account.delete.ts; слияние не нужно: с C-9 колонка не записывается вообще, живых значений не появляется',
  'LoginTicket.approvedUserId':
    'удаление — deleteMany по этой оси в account.delete.ts (L3); слияние — remapAssignerRefs переназначает на target',
  'LoginTicket.shownToTelegramId':
    'удаление — deleteMany по этой оси в account.delete.ts (L3); слияние не нужно: билет живёт 5 минут, переносить нечего',
  'Pair.userId1':
    'удаление — pair.deleteMany по OR двух колонок; слияние — отдельные UPDATE в merge.service (у Pair нет колонки userId)',
  'Pair.userId2':
    'удаление — pair.deleteMany по OR двух колонок; слияние — отдельные UPDATE в merge.service (у Pair нет колонки userId)',
  'Subscription.telegramId':
    'удаление — subscription.deleteMany по адресу в Telegram (не по userId: после слияния они расходятся); слияние — merge-subscriptions.ts',
  'TherapistRequest.reviewedBy':
    'ДОЛГ: кто рассмотрел заявку — это владелец проекта (ADMIN_ID), и при удалении ЕГО аккаунта id останется в чужих строках. Заявителя удаление достаёт по userId, рассматривающего — нет',
  'UserTask.assignedBy':
    'ДОЛГ: удаление достаёт только задания офлайн-клиентов (userId < 0, аудит 2026-10 T8) — у задания живого клиента id ушедшего психолога остаётся; слияние — remapAssignerRefs',
};

describe('Вторичные ссылки на человека (BigInt мимо колонки userId)', () => {
  // `userId` покрыт проверками выше, `therapistId`/`clientId` — трипвайером
  // therapist-side моделей, `User.id` — сам субъект данных.
  const COVERED_ELSEWHERE = new Set(['userId', 'therapistId', 'clientId']);
  const bigIntColumns: string[] = [];
  const modelRe = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema)) !== null) {
    const [, model, body] = m;
    for (const line of body.split('\n')) {
      // `(\s|$)`, а не `\s`: строка уже отрезана от перевода строки, и у
      // колонки без атрибутов (`userId2        BigInt?`) справа ничего нет —
      // с одним `\s` парсер пропускал ровно те колонки, за которыми пришёл.
      const field = /^\s*(\w+)\s+BigInt\??(\s|$)/.exec(line);
      if (!field) continue;
      const column = field[1];
      if (COVERED_ELSEWHERE.has(column)) continue;
      if (model === 'User' && column === 'id') continue;
      bigIntColumns.push(`${model}.${column}`);
    }
  }

  it('sanity: парсер находит вторичные ссылки', () => {
    expect(bigIntColumns).toEqual(
      expect.arrayContaining(['Subscription.telegramId', 'Pair.userId1']),
    );
  });

  it('каждая вторичная ссылка классифицирована', () => {
    const unclassified = bigIntColumns.filter(
      (c) => !(c in PERSON_REF_COLUMNS),
    );
    expect({
      unclassified,
      подсказка:
        'BigInt в этой схеме = идентификатор человека. Колонку мимо userId ' +
        'реестры удаления и слияния не видят — классифицируй её в ' +
        'PERSON_REF_COLUMNS: кто обрабатывает при удалении и при слиянии',
    }).toEqual({ unclassified: [], подсказка: expect.any(String) });
  });

  it('нет протухших записей (колонка удалена или переименована)', () => {
    const known = new Set(bigIntColumns);
    const stale = Object.keys(PERSON_REF_COLUMNS).filter((c) => !known.has(c));
    expect(stale).toEqual([]);
  });

  it('у каждой записи внятная причина', () => {
    const vague = Object.entries(PERSON_REF_COLUMNS)
      .filter(
        ([, why]) => why.trim().length < 20 || /^(legacy|потом)/i.test(why),
      )
      .map(([c]) => c);
    expect(vague).toEqual([]);
  });

  // Трипвайер на сами оси билета входа: причина выше обещает deleteMany в
  // транзакции удаления — проверяем, что он там действительно есть, иначе
  // запись в реестре стала бы обещанием без исполнения.
  it('оси билета входа действительно чистятся в account.delete.ts', () => {
    const src = readFileSync(join(ROOT, 'src/bot/account.delete.ts'), 'utf8');
    expect(src.includes('shownToTelegramId')).toBe(true);
    expect(src.includes('approvedUserId')).toBe(true);
  });
});
