// Security-трипваер: НИ ОДИН новый ввод свободного текста не уходит в прод
// без кризисной детекции (правило №7 CLAUDE.md — терапевтический продукт без
// кризисного пути недопустим). Самый опасный класс регрессии — новый
// компонент с полем ввода, который забыл прогнать текст через
// detectCrisisAny/CrisisCard. Инвариант: каждый .tsx-файл (в
// webapp/schema-miniapp/shared) с <textarea> ИЛИ с <input> свободного текста —
// либо
//   (A) импортирует detectCrisis* — кризисный путь есть, либо
//   (B) в NON_THERAPEUTIC_ALLOWLIST — осознанно НЕ терапевтический свободный
//       текст (админка, запись на приём, заметки терапевта и т.п.), с
//       обоснованием строкой. Allowlist может только СОКРАЩАТЬСЯ;
//   (C) только для <input>: в INPUT_CHILD_CONTROLS — дочерний контрол, чей
//       текст проверяет названный файл-детектор (он обязан звать detectCrisis*),
//       либо в SHORT_INPUT_ALLOWLIST — короткое поле не о переживаниях (имя,
//       код, поиск, подпись), с причиной; потолок — только вниз.
//
// Какой <input> — свободный текст (аудит 2026-10, до этого трипваер смотрел
// только <textarea>): признак — src/test-support/free-text-inputs.ts.
// Свободным считается поле БЕЗ проверяемого признака структуры: `type` из
// закрытого набора (number, email, password, search, checkbox…),
// `autoComplete="one-time-code"`, `inputMode` numeric/decimal/tel/email/url,
// `readOnly`, `aria-hidden="true"` (ловушка для ботов). Без `type` или с
// `type="text"` — свободный текст, пока не доказано обратное: лишний кандидат
// стоит строки allowlist'а, пропущенный — карточки телефона доверия.
import { readFileSync } from 'fs';
import { join } from 'path';
import { collectSourceFiles } from './collect-source-files';
import {
  hasFreeTextInput,
  inputTags,
  isStructuredInput,
} from '../test-support/free-text-inputs';

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

// Все .tsx-файлы с <input> свободного текста (признак — шапка файла).
const FREE_INPUT_FILES = FRONTEND_DIRS.flatMap((rel) => {
  const dir = join(ROOT, rel);
  return collectSourceFiles(dir, { extensions: ['.tsx'] })
    .filter((p) => hasFreeTextInput(readFileSync(p, 'utf8')))
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
  // «Что случилось» в три шага (этап 4 простого клиента): поле сцены с
  // детекцией прямо в файле; CaseSceneScreen (старый поток) удалён с сайта.
  'webapp/src/components/caseFlow/CaseSceneStep.tsx',
  'schema-miniapp/src/components/diary/ModeEntrySheet.tsx',
  // Благодарность (#769): поля и детекция вынесены в GratitudeParts.tsx,
  // GratitudeEntrySheet.tsx остался оркестратором без <textarea>.
  'schema-miniapp/src/components/diary/GratitudeParts.tsx',
  'schema-miniapp/src/components/diary/SchemaEntrySheet.tsx',
  // Имя части в разборе случая (<input>, аудит 2026-10): «своё слово» уходит
  // на сервер сразу по «Назвать», поэтому черновик проверяется на экране.
  'schema-miniapp/src/components/caseFlow/CaseNameScreen.tsx',
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
    // 20 → 19 (2026-10, простой клиент, этап 4): CaseSceneScreen.tsx удалён,
    // новое поле сцены (CaseSceneStep.tsx) само зовёт detectCrisisAny и стоит
    // в EXPECTED_CRISIS_FILES, а не в allowlist.
    expect(Object.keys(NON_THERAPEUTIC_ALLOWLIST).length).toBeLessThanOrEqual(
      19,
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

// ─── <input> свободного текста (аудит 2026-10) ──────────────────────────────

// (C1) Дочерний контрол: поле живёт в одном файле, детекция — в другом, и
// названный файл-детектор проверяет ИМЕННО этот текст (как — в `why`).
const INPUT_CHILD_CONTROLS: Record<string, { detector: string; why: string }> =
  {
    'webapp/src/components/exercises/beliefCheck/EviList.tsx': {
      detector: 'webapp/src/components/exercises/BeliefCheckEx.tsx',
      why: 'доводы за/против: detectCrisisAny(forInput, ...forList) у родителя',
    },
    'webapp/src/components/caseFlow/CaseChipGrid.tsx': {
      detector: 'shared/src/case/useCaseFlowState.ts',
      why: '«своё» тело/импульс пишется в поля потока на каждый ввод (bodyOwn/impulseOwn)',
    },
    'schema-miniapp/src/components/caseFlow/CaseChipGrid.tsx': {
      detector: 'shared/src/case/useCaseFlowState.ts',
      why: '«своё» тело/импульс пишется в поля потока на каждый ввод (bodyOwn/impulseOwn)',
    },
  };

// (C2) Короткое поле не о переживаниях. Сокращать можно, добавлять — с ревью.
const SHORT_INPUT_ALLOWLIST: Record<string, string> = {
  // Имя, контакт, код — у поля свой формат, о себе там не пишут.
  'webapp/src/components/settingsSheet/NameAddressSections.tsx':
    'имя пользователя, до 50 символов',
  'schema-miniapp/src/components/settingsSheet/MiscSections.tsx':
    'имя пользователя, до 50 символов',
  'webapp/src/components/BookingPicker.tsx':
    'имя в записи на приём; «Запрос» — RequestField с BookingCrisisNote',
  'webapp/src/components/booking/ContactChannelField.tsx':
    'контакт для связи (телефон, @ник)',
  'webapp/src/components/settingsSheet/PartnerSection.tsx':
    'код приглашения пары',
  'schema-miniapp/src/components/pairSheet/JoinCodeView.tsx':
    'код приглашения пары',
  'webapp/src/components/settingsSheet/TherapistSections.tsx':
    'код приглашения терапевта',
  'schema-miniapp/src/components/settingsSheet/TherapistClientSection.tsx':
    'код приглашения терапевта',
  // Поиск по готовому списку (клиенты, режимы, команды) — текст никуда не сохраняется.
  'webapp/src/components/AppShell.tsx': 'поиск клиента в шапке кабинета',
  'webapp/src/components/CommandPalette.tsx':
    'поиск по клиентам, страницам и действиям',
  'webapp/src/components/therapist/ClientListView.tsx':
    'поиск клиента в списке',
  // Терапевтская сторона — имя клиента, подписи концептуализации.
  'webapp/src/components/therapist/AddClientForm.tsx':
    'терапевт: имя нового клиента',
  'webapp/src/components/therapist/ClientHeader.tsx':
    'терапевт: переименование клиента',
  'schema-miniapp/src/components/therapistClientSheet/ClientNameHeader.tsx':
    'терапевт: переименование клиента',
  'schema-miniapp/src/components/therapistClientSheet/addPanels/AddInputPanel.tsx':
    'терапевт: имя офлайн-клиента',
  'schema-miniapp/src/components/therapistClientSheet/addPanels/InvitePanel.tsx':
    'терапевт: имя клиента в приглашении',
  'shared/src/therapy/conceptGraph/ConceptAliasField.tsx':
    'концептуализация терапевта: своё имя режима клиента',
  // Карта режимов — короткие подписи узлов, стрелок и дорожек. Тот же класс,
  // что ModeMapNodeEditor в NON_THERAPEUTIC_ALLOWLIST; нужна ли там карточка —
  // решение владельца (docs/open/audit-2026-10.md).
  'webapp/src/components/ModeMapCoupleLanes.tsx':
    'карта режимов: имя партнёра на дорожке',
  'webapp/src/components/ModeMapPalette.tsx':
    'карта режимов: поиск и название своего режима',
  'webapp/src/components/ModeMapSelector.tsx': 'карта режимов: название карты',
  'webapp/src/components/modeMap/ModeMapEdgeEditor.tsx':
    'карта режимов: подпись стрелки',
  'webapp/src/components/modeMap/nodeParts.tsx':
    'карта режимов: переименование узла',
  // Админка — текст пишет владелец проекта.
  'webapp/src/pages/admin/MarqueeSection.tsx': 'админская бегущая строка',
};

describe('трипваер: кризисная детекция для <input> свободного текста (правило №7)', () => {
  it('нет неклассифицированных файлов с <input> свободного текста', () => {
    const unclassified = FREE_INPUT_FILES.filter((rel) => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      return (
        !DETECT_CRISIS_RE.test(src) &&
        !NON_THERAPEUTIC_ALLOWLIST[rel] &&
        !INPUT_CHILD_CONTROLS[rel] &&
        !SHORT_INPUT_ALLOWLIST[rel]
      );
    });
    expect(unclassified).toEqual([]);
  });

  it('allowlist коротких полей не разросся (может только сокращаться)', () => {
    // 23 (2026-11, первый обход <input>): имена, коды, поиск, терапевтская
    // сторона, подписи карты режимов, админка.
    expect(Object.keys(SHORT_INPUT_ALLOWLIST).length).toBeLessThanOrEqual(23);
  });

  it('записи <input>-классификации не протухли: в файле ещё есть свободное поле', () => {
    const stale = [
      ...Object.keys(SHORT_INPUT_ALLOWLIST),
      ...Object.keys(INPUT_CHILD_CONTROLS),
    ].filter((rel) => !FREE_INPUT_FILES.includes(rel));
    expect(stale).toEqual([]);
  });

  it('у каждого дочернего контрола детектор реально зовёт detectCrisis*', () => {
    const blind = Object.values(INPUT_CHILD_CONTROLS)
      .map((c) => c.detector)
      .filter(
        (rel) => !/detectCrisis/.test(readFileSync(join(ROOT, rel), 'utf8')),
      );
    expect(blind).toEqual([]);
  });

  it('скан не ослеп: известные поля свободного текста попадают в выборку', () => {
    // Контрольный образец: без него сломанный разбор тегов дал бы пустую
    // выборку и зелёный тест выше.
    for (const rel of [
      'webapp/src/components/exercises/SafePlaceEx.tsx',
      'schema-miniapp/src/components/caseFlow/CaseNameScreen.tsx',
      'webapp/src/components/exercises/beliefCheck/EviList.tsx',
    ]) {
      expect(FREE_INPUT_FILES).toContain(rel);
    }
  });
});

describe('признак свободного текста у <input> (free-text-inputs.ts)', () => {
  const one = (jsx: string) => {
    const tags = inputTags(jsx);
    expect(tags).toHaveLength(1);
    return isStructuredInput(tags[0]);
  };

  it('свободный текст: без type, type="text", стрелка в обработчике не режет тег', () => {
    expect(
      one(
        '<input value={v} onChange={e => set(e.target.value)} placeholder="Своё слово" />',
      ),
    ).toBe(false);
    expect(one('<input type="text" maxLength={60} />')).toBe(false);
    expect(one("<input type={'text'} />")).toBe(false);
    // Контроль: readOnly={false} — поле редактируется, это свободный ввод.
    expect(one('<input readOnly={false} value={v} />')).toBe(false);
  });

  it('структура: формат, код, поиск, только-чтение, ловушка для ботов', () => {
    expect(one('<input type="email" />')).toBe(true);
    expect(one('<input type="number" min={10} />')).toBe(true);
    expect(one('<input type="search" />')).toBe(true);
    expect(
      one(
        '<input type="checkbox" checked={a} onChange={e => b(e.target.checked)} />',
      ),
    ).toBe(true);
    expect(one('<input autoComplete="one-time-code" maxLength={6} />')).toBe(
      true,
    );
    expect(one('<input inputMode="numeric" />')).toBe(true);
    expect(one('<input readOnly value={url} />')).toBe(true);
    expect(one('<input type="text" tabIndex={-1} aria-hidden="true" />')).toBe(
      true,
    );
  });

  it('файл: одно свободное поле среди структурных — кандидат', () => {
    expect(
      hasFreeTextInput('<input type="email" /><input value={name} />'),
    ).toBe(true);
    expect(
      hasFreeTextInput('<input type="email" /><input inputMode="numeric" />'),
    ).toBe(false);
  });
});
