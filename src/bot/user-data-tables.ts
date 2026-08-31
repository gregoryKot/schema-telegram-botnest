// Реестр таблиц с пользовательскими данными. Отдельным файлом — им пользуются
// и сервис аккаунта, и транзакция удаления (account.delete.ts), а держать
// реестр в одном из них означало бы круговой импорт.
import { PrismaService } from '../prisma/prisma.service';

// ── ЧЕКЛИСТ при добавлении новой таблицы с userId ───────────────────────────
//   1. Добавь имя модели сюда — deleteAllUserData очистит её сам
//   2. В методах сервиса: encryptRecord/decryptRecord (utils/crypto) и
//      константа EncryptSchema рядом с методами
//   3. onDelete: Cascade на связи с User в schema.prisma
//   4. `npx prisma generate` после правок схемы
//
// TypeScript: имя, которого нет у PrismaService, станет ошибкой компиляции.
export const USER_DATA_TABLES = [
  'rating',
  'note',
  'userSchemaNote',
  'userModeNote',
  'userBeliefCheck',
  'userPhraseCheck',
  'userLetter',
  'userSafePlace',
  'userFlashcard',
  'userPractice',
  'practicePlan',
  'practiceSession',
  'childhoodRating',
  'ysqResult',
  'ysqProgress',
  'ysqResultHistory',
  'scheduledNotification',
  'schemaDiaryEntry',
  'modeDiaryEntry',
  'gratitudeDiaryEntry',
  'appActivity',
  'userTask',
  'diaryDraft',
  'emailToken',
  'analyticsEvent',
  'loginTicket',
] as const;

// Проверка на этапе компиляции: неверное имя выше станет ошибкой здесь.
type _VerifyTables = {
  [K in (typeof USER_DATA_TABLES)[number]]: PrismaService[K];
};
