// Security-трипваер: НИ ОДИН новый ввод свободного текста не уходит в прод
// без кризисной детекции (правило №7 CLAUDE.md — терапевтический продукт без
// кризисного пути недопустим). Самый опасный класс регрессии — новый
// компонент с <textarea>, который забыл прогнать текст через
// detectCrisisAny/CrisisCard. Инвариант: каждый .tsx-файл с <textarea>
// (в webapp/schema-miniapp/shared) — либо
//   (A) импортирует detectCrisis* — кризисный путь есть, либо
//   (B) в NON_THERAPEUTIC_ALLOWLIST — осознанно НЕ терапевтический свободный
//       текст (админка, запись на приём, заметки терапевта и т.п.), с
//       обоснованием строкой. Allowlist может только СОКРАЩАТЬСЯ.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walkTsx(p));
    else if (p.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(p)) out.push(p);
  }
  return out;
}

// Директории фронтендов, где вообще может жить пользовательский ввод.
const FRONTEND_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

const TEXTAREA_RE = /<textarea/i;
const DETECT_CRISIS_RE = /detectCrisis/;

// Все .tsx-файлы с <textarea> (свободный текст пользователя), путь
// относительно корня репозитория.
const TEXTAREA_FILES = FRONTEND_DIRS.flatMap((rel) => {
  const dir = join(ROOT, rel);
  return walkTsx(dir)
    .filter((p) => TEXTAREA_RE.test(readFileSync(p, 'utf8')))
    .map((p) => p.replace(ROOT + '/', ''));
});

// (B) Осознанно НЕ терапевтический свободный текст — кризисная детекция тут
// не нужна по смыслу поля. Каждая запись — с обоснованием. Сокращать можно,
// добавлять — только с ревью (это терапевтический продукт, правило №7).
const NON_THERAPEUTIC_ALLOWLIST: Record<string, string> = {
  // Админка — текст пишет владелец проекта, не клиент терапии.
  'webapp/src/pages/admin/HealthyAdultImport.tsx': 'админский импорт контента',
  'webapp/src/pages/admin/ArticleEditor.tsx': 'админский редактор статей сайта',
  'webapp/src/pages/admin/HealthyAdultSection.tsx': 'админская секция контента',
  // Лендинг и запись на приём — контактная форма/бронирование, не дневник.
  'webapp/src/pages/landing/BookingForm.tsx': 'лид-форма записи с лендинга',
  'webapp/src/components/BookingPicker.tsx': 'выбор слота записи на приём',
  // Планы/задачи/заметки настроек — операционный текст (что сделать), а не
  // рефлексия/переживание.
  'webapp/src/components/PlanSheet.tsx': 'план действий — операционный текст',
  'schema-miniapp/src/components/PlanSheet.tsx':
    'план действий — операционный текст',
  'webapp/src/components/TaskCreateSheet.tsx':
    'создание задачи — операционный текст',
  'schema-miniapp/src/components/TaskCreateSheet.tsx':
    'создание задачи — операционный текст',
  'webapp/src/components/SettingsSheet.tsx': 'настройки аккаунта, не дневник',
  'webapp/src/pages/AccountPage.tsx': 'данные аккаунта, не дневник',
  'webapp/src/components/ModeMapNodeEditor.tsx':
    'подпись узла карты режимов — короткая метка, не рефлексия',
  // Терапевтская сторона — заметки специалиста о клиенте, не собственный
  // свободный текст клиента о своём состоянии.
  'webapp/src/components/therapist/ClientSessionsTab.tsx':
    'заметки терапевта о сессии клиента',
  'webapp/src/components/therapist/ClientConceptTab.tsx':
    'концептуализация терапевта, не текст клиента',
  'schema-miniapp/src/components/therapistClientSheet/NotesSheet.tsx':
    'заметки терапевта о клиенте',
  'schema-miniapp/src/components/therapistClientSheet/ConceptSheet.tsx':
    'концептуализация терапевта, не текст клиента',
  'schema-miniapp/src/components/settingsSheet/BecomeTherapistSection.tsx':
    'заявка «стать терапевтом» — анкета, не дневник',
  // Дочерний контрол — детекция стоит у родителя-шита (ModeEntrySheet /
  // SchemaEntrySheet), который прогоняет detectCrisisAny по всем полям.
  'schema-miniapp/src/components/diary/DiaryTextArea.tsx':
    'дочерний <textarea>-контрол, детекция в родительском шите',
};

// Файлы, где кризисная детекция ОБЯЗАНА появиться в рамках текущей задачи
// (правило №7 распространяется на новые компоненты свободного текста —
// LetterToSelf/SafePlace/дневники и т.п.). Список фиксирует ЦЕЛЕВОЕ
// состояние: пока детекцию не добавили параллельные PR-агенты, тест 3 будет
// красным — это ожидаемо и осознанно (см. отчёт), тесты 1/2 при этом не
// затрагиваются, т.к. эти файлы уже попадают в TEXTAREA_FILES и должны быть
// классифицированы отдельно (см. EXPECTED_CRISIS_FILES ниже).
const EXPECTED_CRISIS_FILES = [
  'schema-miniapp/src/components/LetterToSelf.tsx',
  'schema-miniapp/src/components/SafePlace.tsx',
  'schema-miniapp/src/components/NoteSheet.tsx',
  'schema-miniapp/src/components/WeeklyQuestion.tsx',
  'schema-miniapp/src/components/BeliefCheck.tsx',
  'schema-miniapp/src/components/IntroSheetFlashcard.tsx',
  'schema-miniapp/src/components/schemaFlashcard/ResponseStep.tsx',
  'schema-miniapp/src/components/schemaFlashcard/ActionStep.tsx',
  'webapp/src/components/NoteSheet.tsx',
  'webapp/src/components/SchemaFlashcard.tsx',
  'webapp/src/components/exercises/LetterEx.tsx',
  'webapp/src/components/exercises/BeliefCheckEx.tsx',
  'webapp/src/components/exercises/FlashcardEx.tsx',
  // Дневниковые шиты — образец правильного пути (уже сделаны), санити-якорь
  // на случай, если грепы выше молча сломаются.
  'webapp/src/components/diary/ModeEntrySheet.tsx',
  'webapp/src/components/diary/GratitudeEntrySheet.tsx',
  'webapp/src/components/diary/SchemaEntrySheet.tsx',
  'schema-miniapp/src/components/diary/ModeEntrySheet.tsx',
  'schema-miniapp/src/components/diary/GratitudeEntrySheet.tsx',
  'schema-miniapp/src/components/diary/SchemaEntrySheet.tsx',
];

describe('трипваер: кризисная детекция для свободного текста (правило №7)', () => {
  it('нет неклассифицированных <textarea>-файлов (новый = детекция или allowlist)', () => {
    const unclassified = TEXTAREA_FILES.filter((rel) => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      return !DETECT_CRISIS_RE.test(src) && !NON_THERAPEUTIC_ALLOWLIST[rel];
    });
    // Файлы, для которых детекцию ещё доводят параллельные агенты этого же
    // PR, не считаются «новым нарушением» — они уже явно поставлены в цель
    // (EXPECTED_CRISIS_FILES) и будут проверены отдельно тестом 3.
    const trulyUnclassified = unclassified.filter(
      (rel) => !EXPECTED_CRISIS_FILES.includes(rel),
    );
    expect(trulyUnclassified).toEqual([]);
  });

  it('allowlist не разросся сверх известного (может только сокращаться)', () => {
    expect(Object.keys(NON_THERAPEUTIC_ALLOWLIST).length).toBeLessThanOrEqual(
      18,
    );
  });

  it('санити: ключевые терапевтические шиты подключают детекцию (diary + letter/safe place и т.п.)', () => {
    const missing = EXPECTED_CRISIS_FILES.filter((rel) => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      return !DETECT_CRISIS_RE.test(src);
    });
    // ВАЖНО: до посадки правок параллельных агентов (LetterToSelf, SafePlace,
    // дневники и т.д.) этот тест красный — это ожидаемо, см. отчёт задачи.
    // Дневниковые шиты (последние 6 в EXPECTED_CRISIS_FILES) уже должны
    // проходить сегодня — это якорь, что regex/пути верны.
    expect(missing).toEqual([]);
  });
});
