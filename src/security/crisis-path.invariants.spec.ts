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
import { readFileSync } from 'fs';
import { join } from 'path';
import { collectSourceFiles } from './collect-source-files';

const ROOT = join(__dirname, '..', '..');

// Директории фронтендов, где вообще может жить пользовательский ввод.
const FRONTEND_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

// `<LimitedTextarea` — общая обёртка поля с пределом длины (shared): без неё в
// регэкспе все поля, переехавшие на обёртку, выпали бы из-под трипваера.
const TEXTAREA_RE = /<(?:textarea|LimitedTextarea)/i;
// Детекцией считается и прямой вызов detectCrisis*, и общие гейт-примитивы:
// <CrisisGate> (schema-miniapp/src/components/CrisisGate.tsx) и
// <BookingCrisisNote> (webapp/src/components/booking/BookingCrisisNote.tsx,
// форма записи на визитке) — оба инкапсулируют detectCrisisAny + карточку; что
// сами они реально зовут detectCrisis, фиксируют отдельные тесты ниже.
const DETECT_CRISIS_RE = /detectCrisis|CrisisGate|BookingCrisisNote/;

// Все .tsx-файлы с <textarea> (свободный текст пользователя), путь
// относительно корня репозитория.
const TEXTAREA_FILES = FRONTEND_DIRS.flatMap((rel) => {
  const dir = join(ROOT, rel);
  return collectSourceFiles(dir, { extensions: ['.tsx'] })
    .filter((p) => TEXTAREA_RE.test(readFileSync(p, 'utf8')))
    .map((p) => p.replace(ROOT + '/', ''));
});

// (B) Осознанно НЕ терапевтический свободный текст — кризисная детекция тут
// не нужна по смыслу поля. Каждая запись — с обоснованием. Сокращать можно,
// добавлять — только с ревью (это терапевтический продукт, правило №7).
const NON_THERAPEUTIC_ALLOWLIST: Record<string, string> = {
  // Админка — текст пишет владелец проекта, не клиент терапии.
  'webapp/src/pages/admin/HealthyAdultImport.tsx': 'админский импорт контента',
  'webapp/src/pages/admin/HealthyAdultCheck.tsx':
    'админская проверка текста фразы перед сохранением',
  'webapp/src/pages/admin/ArticleEditor.tsx': 'админский редактор статей сайта',
  'webapp/src/pages/admin/HealthyAdultSection.tsx': 'админская секция контента',
  // Поле «Запрос» записи на приём (BookingForm и BookingPicker) здесь больше
  // не числится: посетитель описывает там своё состояние до всякого контакта,
  // это свободный текст о переживаниях — кризисный путь подключён (аудит
  // 2026-10, frontends#5; RequestField → BookingCrisisNote), запись снята.
  // Планы/задачи/заметки настроек — операционный текст (что сделать), а не
  // рефлексия/переживание.
  'webapp/src/components/PlanSheet.tsx': 'план действий — операционный текст',
  'schema-miniapp/src/components/PlanSheet.tsx':
    'план действий — операционный текст',
  'webapp/src/components/TaskCreateSheet.tsx':
    'создание задачи — операционный текст',
  'schema-miniapp/src/components/TaskCreateSheet.tsx':
    'создание задачи — операционный текст',
  // SettingsSheet распилен (правило №10): <textarea> анкеты «стать
  // терапевтом» уехал в BecomeTherapistSection, сам SettingsSheet остался
  // без свободного текста — запись переехала за полем, а не добавилась.
  'webapp/src/components/settingsSheet/BecomeTherapistSection.tsx':
    'заявка «стать терапевтом» — анкета, не дневник',
  // AccountPage распилен: <textarea> (анкета заявки терапевта) уехал в
  // TherapistRequestSection; сам AccountPage больше без свободного текста.
  'webapp/src/pages/account/TherapistRequestSection.tsx':
    'анкета заявки терапевта, не дневник',
  'webapp/src/components/ModeMapNodeEditor.tsx':
    'подпись узла карты режимов — короткая метка, не рефлексия',
  // Терапевтская сторона — заметки специалиста о клиенте, не собственный
  // свободный текст клиента о своём состоянии.
  'webapp/src/components/therapist/ClientSessionsTab.tsx':
    'заметки терапевта о сессии клиента',
  // Вид «Поля» уехал из ClientConceptTab/ConceptSheet в отдельные файлы
  // (правило №10): запись переехала за <textarea>, а не добавилась. Поля
  // связей режимов графической концептуализации — ConceptTextField (shared,
  // общий для обоих фронтендов): тот же класс «концептуализация терапевта».
  'webapp/src/components/therapist/ClientConceptFields.tsx':
    'концептуализация терапевта, не текст клиента',
  'shared/src/therapy/conceptGraph/ConceptTextField.tsx':
    'концептуализация терапевта (связи режимов), не текст клиента',
  'schema-miniapp/src/components/therapistClientSheet/NotesSheet.tsx':
    'заметки терапевта о клиенте',
  'schema-miniapp/src/components/therapistClientSheet/conceptSheet/ConceptFieldsView.tsx':
    'концептуализация терапевта, не текст клиента',
  'schema-miniapp/src/components/settingsSheet/BecomeTherapistSection.tsx':
    'заявка «стать терапевтом» — анкета, не дневник',
  // Дочерний контрол — детекция стоит у родителя-шита (ModeEntrySheet /
  // SchemaEntrySheet), который прогоняет detectCrisisAny по всем полям.
  'schema-miniapp/src/components/diary/DiaryTextArea.tsx':
    'дочерний <textarea>-контрол, детекция в родительском шите',
  // Общая обёртка поля с пределом длины (backend#29): сама ничего не знает о
  // содержании, детекция стоит у каждого вызывающего — они попадают в скан
  // через `<LimitedTextarea` (регэксп выше) и классифицируются поштучно.
  'shared/src/components/LimitedTextarea.tsx':
    'дочерний <textarea>-контрол с пределом длины, детекция у вызывающих',
  // Разбор случая (webapp): сцена — поле общего shared-хука
  // useCaseFlowState (crisis = detectCrisisAny(scene, bodyOwn, impulseOwn,
  // alias)), CrisisCard рисует CaseFlowFoot на том же экране. Тот же приём,
  // что у DiaryTextArea.tsx строкой выше — не выдуманное исключение
  // (правило №15), а тот же класс «дочерний контрол».
  'webapp/src/components/caseFlow/CaseSceneScreen.tsx':
    'дочерний <textarea>-контрол потока разбора случая, детекция в общем shared/src/case/useCaseFlowState.ts',
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
  // Проверка убеждения: свободный текст живёт в двух шагах, детекция
  // переехала вместе с ними (BeliefCheck.tsx остался оркестратором без
  // <textarea>) — тот же случай, что ModeEntrySheet → ModeEntryForm ниже.
  'schema-miniapp/src/components/beliefCheck/BeliefStep.tsx',
  'schema-miniapp/src/components/beliefCheck/ReframeStep.tsx',
  'schema-miniapp/src/components/IntroSheetFlashcard.tsx',
  'schema-miniapp/src/components/schemaFlashcard/ResponseStep.tsx',
  'schema-miniapp/src/components/schemaFlashcard/ActionStep.tsx',
  'webapp/src/components/NoteSheet.tsx',
  // «Мне плохо» (#746): шаги со свободным текстом и детекция переехали из
  // SchemaFlashcard.tsx в FlashcardSteps.tsx, оркестратор остался без <textarea>.
  'webapp/src/components/flashcard/FlashcardSteps.tsx',
  'webapp/src/components/exercises/LetterEx.tsx',
  'webapp/src/components/exercises/BeliefCheckEx.tsx',
  'webapp/src/components/exercises/FlashcardEx.tsx',
  // Дневниковые шиты — образец правильного пути (уже сделаны), санити-якорь
  // на случай, если грепы выше молча сломаются. В webapp форма дневника режимов
  // вынесена в ModeEntryForm — детекция живёт там (ModeEntrySheet теперь без
  // <textarea>: только выбор режима/тест).
  'webapp/src/components/diary/ModeEntryForm.tsx',
  'webapp/src/components/diary/GratitudeEntrySheet.tsx',
  'webapp/src/components/diary/SchemaEntrySheet.tsx',
  'webapp/src/components/diary/quickEntry/QuickWriteStep.tsx',
  'schema-miniapp/src/components/diary/ModeEntrySheet.tsx',
  // Благодарность (#769): поля и детекция вынесены в GratitudeParts.tsx,
  // GratitudeEntrySheet.tsx остался оркестратором без <textarea>.
  'schema-miniapp/src/components/diary/GratitudeParts.tsx',
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
    // 18 → 19 (2026-08): админская проверка текста фразы перед сохранением
    // (HealthyAdultCheck). Поле админское — туда владелец вставляет фразу
    // пула, чтобы увидеть претензии до сохранения; это не свободный текст
    // клиента терапии. Потолок поднимается только так — правкой в диффе,
    // видимой на ревью, а не молча.
    // 19 → 20 (2026-08, перенос «Разбор случая» в webapp): CaseSceneScreen.tsx —
    // дочерний <textarea>-контрол потока, тот же класс, что уже допущенный
    // DiaryTextArea.tsx строкой выше (детекция стоит в родительском shared-хуке).
    // 20 → 18 (2026-10, frontends#5): поле «Запрос» формы записи получило
    // кризисную карточку — BookingForm.tsx и RequestField.tsx сняты с allowlist.
    // 18 → 19 (2026-10, backend#29): shared/LimitedTextarea.tsx — общий
    // контрол-обёртка `<textarea>` с `maxLength` и счётчиком, тот же класс
    // «дочерний контрол», что DiaryTextArea/CaseSceneScreen; вызывающие файлы
    // скан ловит по `<LimitedTextarea`.
    // 19 → 20 (2026-10, графическая концептуализация): shared/ConceptTextField —
    // поля «Откуда режим / Как проявляется / Что делаем в терапии» в кабинете
    // терапевта, тот же класс, что соседние ClientConceptFields/ConceptFieldsView
    // (их записи переехали за <textarea>, не добавились).
    expect(Object.keys(NON_THERAPEUTIC_ALLOWLIST).length).toBeLessThanOrEqual(
      20,
    );
  });

  it('CrisisGate (общий гейт miniapp) сам зовёт detectCrisisAny и CrisisCard', () => {
    // Регэксп категории (A) засчитывает <CrisisGate> как детекцию — этот
    // якорь гарантирует, что гейт не выродился в пустышку без детекции.
    const src = readFileSync(
      join(ROOT, 'schema-miniapp/src/components/CrisisGate.tsx'),
      'utf8',
    );
    expect(src).toMatch(/detectCrisisAny/);
    expect(src).toMatch(/CrisisCard/);
  });

  it('BookingCrisisNote (форма записи на визитке) сам зовёт detectCrisisAny и карточку', () => {
    // Регэксп категории (A) засчитывает <BookingCrisisNote> как детекцию — якорь
    // против выродившегося в пустышку примитива (тот же приём, что у CrisisGate).
    const src = readFileSync(
      join(ROOT, 'webapp/src/components/booking/BookingCrisisNote.tsx'),
      'utf8',
    );
    expect(src).toMatch(/detectCrisisAny/);
    expect(src).toMatch(/CrisisCardView/);
  });

  it('форма записи: оба экрана с полем «Запрос» и оба терминальных экрана подключают детекцию', () => {
    // RequestField — единственный <textarea> «Запроса» (BookingForm и
    // BookingPicker берут его); результат — DoneScreen/AwaitPaymentScreen и
    // «Заявка отправлена» простой формы. Потеря любого звена — карточки нет.
    for (const rel of [
      'webapp/src/components/booking/RequestField.tsx',
      'webapp/src/components/booking/BookingResultScreens.tsx',
      'webapp/src/pages/landing/BookingForm.tsx',
    ]) {
      expect(readFileSync(join(ROOT, rel), 'utf8')).toMatch(
        /BookingCrisisNote/,
      );
    }
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
