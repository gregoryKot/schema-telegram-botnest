# Карта: фронтенды — webapp, shared, game

> Подробности к [docs/ARCHITECTURE.md](../ARCHITECTURE.md). Читай раздел нужной площадки
> (`grep -n '^### ' docs/architecture/frontends.md`), а не весь файл. Карта врёт или
> молчит — исправь строку в том же PR и запиши промах в [docs/agent/NAV_LOG.md](../agent/NAV_LOG.md).

### `webapp/` (сайт schemehappens.ru + визитка kotlarewski.*, JWT)
- **Вход:** `webapp/src/main.tsx` подключает `webapp/src/index.css`, `webapp/src/styles/index-tail.css` (разделы экранов, вынесенные из конца `index.css`), затем `shared/src/theme/utilities.css` (порядок важен), ставит `installChunkReloadListener()` и рендерит `App`.
- **Роутинг:** все роуты в `webapp/src/App.tsx` (react-router-dom 7, `createBrowserRouter`), отдельного файла роутов нет. Два набора роутов, выбор по `isPersonalSite`:
  - `personalRoutes` — визитка практики: хост `kotlarewski.*` (`isPracticeHost`, `webapp/src/utils/domainChrome.ts`) или `?site=personal`. Роуты: `/`, `/articles`, `/reviews`, `/admin`, `/book`, `/booking/paid|manage`, `/subscribe`, `/donate`, `/privacy`, `/offer`. Продукта «Всё по схеме» здесь нет, сессия не поднимается (`AuthProvider bootstrapSession={!isPersonalSite}`).
  - `appRoutes` — продукт: лендинг, `/tests`, `/login`, `/auth/*`, `/link`. Юрстраницы `/privacy` и `/offer` — в обоих наборах: на них ведут вход, согласие и подвалы; карта сайта сверяется с `appRoutes` (`src/articles/sitemap.middleware.spec.ts`). Закрытая часть идёт через layout `RequireAuth` → `/account`, `/account/merge` и `AppShell`.
- **Разделы кабинета:** роуты `/today /diary /more /schemas /profile /practice /cabinet[/:clientId]` заданы с `element: null`. Реально разделы рисует `webapp/src/components/AppShell.tsx` по `sectionFromPath` (`webapp/src/components/appShell/navigation.ts`, тип `Section = today|diary|more|schemas|profile|practice`) через `webapp/src/components/appShell/AppSections.tsx`. Вкладки меню клиента — `MOBILE_NAV_ITEMS`/`DESKTOP_NAV_ITEMS` в `webapp/src/components/appShell/navItems.ts`: на телефоне «Сегодня», «Записи» (`/diary`), «Ещё» (`/more`, `webapp/src/sections/MoreSection.tsx`), а `schemas`, `practice` и `profile` открываются из «Ещё» и по прямому URL; на компьютере они в меню слева. Оверлеи: `webapp/src/components/appShell/useOverlays.ts`, `webapp/src/components/appShell/AppOverlays.tsx`, `webapp/src/components/appShell/EntryFlows.tsx`. Режим терапевта — `/cabinet*`: меню «Сегодня» (`/cabinet/today`, `webapp/src/sections/TherapistTodaySection.tsx`), «Клиенты» (`/cabinet`, карточка `/cabinet/<код>`), «Справочник» (`/cabinet/guide`, `webapp/src/sections/TherapistGuideSection.tsx`), «Задания» (доска `/cabinet/tasks`); свои экраны перечислены в `CABINET_PAGES` (`AppSections.tsx`), остальной `/cabinet*` — список или карточка клиента. Пункты меню и их знаки — одна таблица `webapp/src/components/appShell/navLook.ts` (`SECTION_LOOK` клиента, `THERAPIST_NAV` кабинета) на сайдбар, полоску и нижнюю панель; рисунок знака в главном чанке — `appShell/NavSign.tsx`. Сайдбар десктопа — `webapp/src/components/appShell/Sidebar.tsx` (карточка дня, «Показ экрана» и подвал — `appShell/SidebarFoot.tsx`), шапка — `appShell/ShellTopbar.tsx`; силуэт первой загрузки кабинета — `webapp/src/components/appShell/AppShellSkeleton.tsx` (меню — `appShell/SidebarSkeleton.tsx`, разделы — `webapp/src/components/ShellSkeletons.tsx`, их же берёт загрузка раздела); силуэт до входа — `webapp/src/components/AuthGateViews.tsx`; «Не удалось загрузить» — `appShell/LoadErrorScreen.tsx`.
- **Каталоги:**
  - `webapp/src/pages/` — страницы-роуты (`LoginPage`, `InstallPage` (`/install`: установка PWA, посадочная для рекламы, вход по коду передачи сессии из мессенджера), `AccountPage`, `AdminPage` (lazy), `Booking*`, `Donate`, `Subscribe`, `Articles`, `LandingPage` и `ProductLandingPage`; подпапки `tests/`, `login/`, `admin/` и т.д.).
  - `webapp/src/sections/` — экраны кабинета: `Today`, `Diary`, `More`, `Schemas`, `Practice`, `Profile`, `TherapistToday` (+ подпапки).
  - `webapp/src/components/` — весь остальной UI: шторки и оверлеи, `Dialog`, `Skeleton`, `booking/`, `therapist/`, `modeMap*`, `landing-kit.tsx`, `appShell/`, `therapy/` (мост к терапевту клиента: `TherapyLine`, `TalkSheet`, `TherapyNudgeCard`; логика — `shared/src/therapy/bridge/`), `art/` (язык знаков и сцены бумаги: знак по ключу — `SignArt.tsx`, ключ и оттенок сущности — `shared/src/theme/entityLook.ts`; новые знаки — `AppSigns.tsx`; общие сцены приложения — `AppScenes.tsx`, `AppScenesMore.tsx` (`Sprout`, `SceneBreath`, `ScenePebbleLaid`, `SceneJourney`, `ScenePathStart`, `SceneConceptStart`, `DoneScene`); сцены лендинга — `LandingScenes*.tsx`, `HeroCollage.tsx`; проверка новой сцены — `sceneContract.test-helpers.ts`), `paper/` (заготовки рабочих экранов на живой бумаге, стили — `styles/paper-app.css`, префикс `pa-`: лист-герой сущности `EntitySheet` по ENTITY_LOOK или готовому виду, разворот на ≥1024 `SpreadLayout`, «лист готово» `DoneSheet` со сценой «готово» сущности, сбой строкой `PaperAlert` (на нём `SaveErrorNote`), полноэкранный исход `PaperOutcome` по `OUTCOME_LOOK`, чип со знаком `SignChip`, знак по ключу крупно с тенью-вырезкой `SignHero`, шапка окон первого входа `EntryHead` (+ `EntrySteps`, `EntryBrand`; вид — `entryLook.ts`, стили — `styles/entry-flows.css`)). Герой упражнения — `ExScreen look` (+ `hintBeforeField`, `spread`; шапка — `exercises/ExHead.tsx`), герой листов схем — `SsHead look` + `SsSheet hero`/`spread`; дисклеймер строкой — `TherapyCaution compact`; фото автора — `components/AuthorAvatar.tsx` (`AuthorAvatar` круглый, `AuthorPhoto` с наклейкой Talk, стили `styles/author-photo.css`).
  - `webapp/src/hooks/` — `useHistorySheet`, `useHostBackButton`, `useHostShell`, `useHostSafeTop`, `useAsyncData`, `useQuizRunner`, `useGoogleOneTap` (окно «Продолжить как…», только на экране входа; скрипт Google грузит `gsiScript.ts`, client id — `ARG VITE_GOOGLE_CLIENT_ID` в `Dockerfile`, сверка `src/test-support/gates/google-one-tap-build.spec.ts`), `useIsOffline`, `useOutboxFlushOnOnline`.
  - `webapp/src/utils/` — `addressForm.ts`, `AddressFormProvider.tsx`, `apiBase.ts`, `domainChrome.ts`, `theme.ts`, `uiPrefsSync.ts`, `chunkReload.ts`; часть файлов — реэкспорты из shared.
  - `webapp/src/auth/` — `AuthProvider`, `authContext`, `refreshSession` (refresh-кука и кросс-табный замок), `telegramWebAppAuth`, `loginConsent`, `clearLocalData`.
  - `webapp/src/host/` — поведение внутри WebView Telegram/MAX: `initHost`, `ExternalLink`, `useHostId`. Само определение хоста лежит в `shared/src/host/`.
  - `webapp/src/push/` — веб-пуши на этом устройстве: `pushState.ts` (состояния unsupported / ios-install / denied / off / on), `pushSubscription.ts` (разрешение только по клику, регистрация `public/sw.js`, отписка при выходе и после удаления аккаунта), `pushApi.ts`, хук `usePushDevice.ts` для строки «На этом устройстве» в настройках. Подставной браузер для тестов — `pushBrowser.test-helpers.ts`.
  - `webapp/src/styles/` — css по экранам и шторкам. `webapp/src/index.css` сам импортирует `cabinet.css`, `paper.css` и `touch-fixes.css`, остальные подключаются из компонентов (`import '../styles/…css'`).
  - Раскрой 2026-11: у каждого экрана свой файл. Общий файл, который подключают компоненты разных экранов, — сборник из `@import` (`sheet-tasks.css`, `sheet-diary.css`, `index-tail.css`) или файл экрана, чьи чужие разделы подключены `@import` в начале (`sheet-exercises.css`, `sheet-schemas.css`, `sheet-tracker.css`, `tracker-question.css`, `client-practice.css`, `practice-selfhelp.css`, `therapy-bridge.css`, `therapist-concept.css`). Порядок `@import` — это порядок правил в сборке; его и то, что часть не подключает компонент напрямую, держит `webapp/src/styles/cssSplit.test.ts`. Новое правило — в файл своего экрана.
  - `webapp/src/lib/` — Метрика (`metrika*.ts`, `webvisorRoutes.ts`) и `tone.ts` (оттенки разделов).
  - `webapp/src/legal/` — `operator.ts`: реквизиты оператора (оферта, политика, футер визитки); `LegalLayout.tsx` + `legalStyles.ts`: разметка и стили обеих страниц (глава, таблица реквизитов, поля).
  - `webapp/src/share/` — кнопки и шторка шаринга (`DayShareButton`, `DiaryShareButton`, `ShareCardSheet`, `SharePillButton`, `TherapistInviteShare`).
  - `webapp/src/security/` — только тест-инвариант XSS (`xss.invariants.test.ts`).
  - `webapp/src/assets/` — `hero.png`, `vite.svg`.
  - `webapp/src/test-support/` — `mockCanvas2d.ts`, `renderWithFlow.tsx`, `rtlCleanup.ts`, `crashScreenGuard.ts` (тест краснеет, если в DOM остался экран падения), `crisisCardHarness.ts` (`describeCrisisField`: ввод кризисной фразы в поле → телефон доверия и детская линия; новое поле свободного текста с детекцией — строка в его тесте, сверку держит `src/security/crisis-card-behavior.invariants.spec.ts`).
  - `webapp/public/` — `fonts/`, иконки и favicon, `manifest.webmanifest`, `theme.js` (тема до первого кадра, из-за CSP не инлайн), `asset-recovery.js` (стартовый файл сборки не дошёл — CSS запрашивается снова, упавший входной модуль перезагружает страницу, не больше трёх раз за 2 мин; инцидент 2026-11-04), `telegram-web-app.js`, `max-bridge.js`, `robots.txt`, `llms.txt`, файлы верификации Яндекса.
  - Прочее в `webapp/src/`: `api.types.ts` и реэкспорты-заглушки (`needData.ts`, `haptic.ts`, `types.ts`).
- **Упражнения клиента (что и откуда запускается):** `useTaskLauncher.openExercise({ ex })` → хост `webapp/src/sections/today/TaskExerciseHost.tsx`; ex-id → файл: belief `components/exercises/BeliefCheckEx.tsx`, schema/mode `FlashcardEx.tsx` (SchemaEx, ModeEx), letter `LetterEx.tsx`, safe `SafePlaceEx.tsx`, warm `WarmWordsEx.tsx`, phrase `PhraseCheckEx.tsx`, flashcard `components/SchemaFlashcard.tsx` (шаги — `flashcard/FlashcardSteps.tsx`), ysq `components/YSQTestSheet.tsx` (`ysq/YsqIntro`, `YsqResult`). Колесо детства `exercises/ChildhoodWheelEx.tsx` открывает `PracticeSection` напрямую. Общая оболочка экрана упражнения и «Готово» — `exercises/ExScreen.tsx` (`ExScreen`, `ExDone`; проп `caution` — предупреждение моста к терапевту на первом экране). Разбор случая — `components/caseFlow/CaseFlowHost.tsx`; дыхание и быстрые практики — `components/practice/QuickPracticeSheet.tsx` (дыхание — живой лист `BreathingSheet.tsx` на той же рамке `createBreathingCard`, что в разделе; заземление и «Стоп» — `StepFlowSheet.tsx` → `QuickStepBody.tsx`); трекер — `components/TrackerOverlay.tsx`.
- **API-клиент:**
  - `webapp/src/apiClient.ts` — HTTP-слой: `authedFetch`, `get/post/postJson/patchJson/del`, `ApiError`.
  - `webapp/src/api.ts` — доменные методы (объект `api`).
  - Админка (`adminReq`) ходит мимо JWT, с заголовком `x-admin-key`.
- **Токены:**
  - Access-токен лежит в памяти (state + ref в `AuthProvider`, в localStorage его нет).
  - `webapp/src/auth/TokenBridge.tsx` передаёт `getAccessToken` (ref, синхронно) в `setTokenProvider` и `refreshToken` в `setRefreshHandler`.
  - После OAuth сессию даёт только refresh по куке из редиректа; фрагмент `#access_token` не читается (`webapp/src/pages/authCallback/HashCallback.tsx`, `dropUrlFragment.ts`).
  - Адрес возврата после входа (`auth_return_to`, sessionStorage вкладки): пишут `RequireAuth`, `LinkDevicePage`, привязка способа входа; забирают вход, 2FA и колбэки — всё через `webapp/src/auth/returnTo.ts` (только внутренний путь).
  - Refresh — httpOnly-кука: `POST /api/auth/refresh` с `credentials:'include'` и `x-requested-with: webapp` (`webapp/src/auth/refreshSession.ts`).
- **ты/вы:**
  - Инфраструктура одна, в `shared/src/utils/addressForm.ts`: `AddressFormContext`, `useAddressForm`, `useSetAddressForm`, `useTr()` (`tr('текст на ты','текст на вы')`), `pickForm`.
  - `webapp/src/utils/addressForm.ts` — реэкспорт.
  - `webapp/src/utils/AddressFormProvider.tsx` грузит `api.getSettings().addressForm` через `shared/src/utils/addressFormCache.ts` (`useAddressFormValue`). Старт идёт из localStorage `address_form`, чтобы не было вспышки «ты».
  - Провайдер смонтирован внутри `RequireAuth`, `webapp/src/components/AddressFormPicker.tsx` — первый шаг очереди `webapp/src/components/appShell/EntryFlows.tsx` (порядок — `appShell/entryQueue.ts`): вопрос «ты/вы» → согласия → ссылка-приглашение, один слой за раз. Конец очереди — контекст `EntryFlowsDoneContext`, его ждёт автопоказ «Первый раз здесь» (`sections/today/useWhySheet.ts`); баннер куки ждёт закрытия диалогов и листов (`useAnyDialogOpen` из `shared/src/utils/dialogStack.ts` + `useAnySheetOpen`). Закрытие чужим `navigate` (push/replace) ответом не считается — вопрос переоткрывается. Публичные страницы получают дефолт `'ты'` из контекста.
  - Логика пикера — `shared/src/settings/useAddressFormChoice.ts` и `shared/src/settings/addressFormPrompt.ts`.
- **`useHistorySheet`:** `webapp/src/hooks/useHistorySheet.ts`, стек листов в `webapp/src/hooks/historySheetStack.ts`, реестр открытых — `webapp/src/hooks/openSheets.ts`.
  - Хук делает `navigate()` через react-router и кладёт стек id в `location.state.__sheetStack`. Прямой `history.pushState` запрещён.
  - Лист закрывается, когда его id пропал из стека. Escape закрывает верхний лист. Возвращаемый `goBack` используется для всех закрытий листа.
- Волна 6: страницы «Записей» — `webapp/src/sections/diary/diaryPages.ts`; адрес возврата из ссылки письма — `webapp/src/auth/emailReturnTo.ts`; вид плиток, квадратов и строк «Практик» литералами ENTITY_LOOK — `webapp/src/sections/practice/practiceLook.ts` (верхний ряд с прокруткой к блокам снят в b14).

### Мини-апп Telegram/MAX (каталога нет)
- Отдельный каталог мини-аппа удалён целиком (решения владельца 2026-10-17 и 2026-11-04, #908). Кнопки бота (`web_app`) в Telegram и MAX открывают сайт — кабинет `/today`; вход по подписи мессенджера (`x-telegram-init-data` / `x-max-init-data`) обрабатывает `webapp/`. Старый адрес `/app/*` навсегда отвечает 302 → `/today` (`src/unified-frontend.middleware.ts`).

### `shared/`
- **Что здесь:** единственная копия общего кода (сайт и игра) — типы, чистая логика, хуки, тексты и контент, общие компоненты, CSS-токены.
  - Корневые файлы: `shared/src/types.ts`, `shared/src/apiTypes.ts`, `shared/src/userId.ts` (id может быть строкой больше 2^53).
  - Правило №3: общий код живёт здесь, одна механика — один модуль.
- **Как подключается:**
  - Не собирается сам и не npm-пакет: фронт импортирует относительными путями `../../shared/src/...` (например `webapp/src/main.tsx` импортирует `shared/src/theme/utilities.css`).
  - В vite нужны `server.fs.allow: ['..']` и `resolve.dedupe: ['react','react-dom']`.
  - Свои `shared/package.json` и `shared/vitest.config.ts` только для тестов.
- **Общий API:**
  - `shared/src/api/sharedApi.ts` — `buildSharedApi(transport)`. `ApiTransport = {get, post, postJson, del}`, транспорт даёт `webapp/src/apiClient.ts`.
  - `createRatingApi(authedFetch, trackEvent)` (`shared/src/api/ratingApi.ts`) — оценки с оффлайн-outbox.
  - `createPracticeSessionsApi(transport)` (`shared/src/api/practiceSessionsApi.ts`).
  - В `webapp/src/api.ts`: `export const api = { ...buildSharedApi(transport), ...ratingApi, ...createPracticeSessionsApi(transport), …локальные методы }`.
  - Локальное: booking, articles, admin, therapy и др.
  - Метод, нужный и сайту, и игре, добавляется в `sharedApi.ts`.
- **Вокруг API:** кеш GET (`shared/src/api/apiCache.ts`, `shared/src/api/apiCacheRules.ts`, `shared/src/api/apiCacheRules.data.ts`; ручки `/api/therapy/*` — `shared/src/api/apiCacheRules.therapy.ts`, id офлайн-клиента в пути отрицательный), `readJsonBody`, `readErrorBody`, `humanizeError` (текст ошибки для экрана: лимит, авария, сеть, служебный английский → запасной текст), `clientErrorReport`.

**`shared/src/*` — подкаталоги (44):**

| dir | что внутри |
|---|---|
| `shared/src/about/` | тексты «Зачем это всё» и пяти потребностей |
| `shared/src/account/` | ссылки аккаунтов, удаление с TOTP, экспорт данных |
| `shared/src/analytics/` | трекинг показа кризисной карточки; константы событий (`homeTile.ts`, `therapyNudge.ts` — «мост к терапевту») |
| `shared/src/api/` | фабрики api, кеш GET, разбор ответов и ошибок |
| `shared/src/auth/` | refresh сессии, кросс-табный замок, владелец данных, тикет входа |
| `shared/src/beliefCheck/` | «Проверка убеждения»: форма мастера с черновиком (`useBeliefCheckForm`) |
| `shared/src/booking/` | часовой пояс клиента, канал связи, региональная цена; `useBookingSlots` — загрузка слотов одна на визитку (`BookingPicker`) и запись клиента из приложения (`webapp/src/components/booking/ClientBookingSheet.tsx`, #546) |
| `shared/src/build/` | vite-плагин `requireBotUsername` |
| `shared/src/case/` | поток «Что это было»: типы, состояние, сохранение; `quick/` — три шага сайта |
| `shared/src/childhoodWheel/` | колесо детства: данные и примеры; `useRatingSlider` — ползунок 0–10 (указатель, клавиатура, aria); `sliderGesture` — значение по тапу или сдвигу вбок, вертикаль — прокрутка |
| `shared/src/components/` | общие компоненты: CrisisCard, Celebration, TherapyNote, Ysq*, ConnectionTrouble |
| `shared/src/diary/` | мета дневников, пояснения, благодарности; `diaryDay` — «сегодня» дневника = местный день человека; `diaryPrivacy` + `useDiaryAccess` — «кто увидит записи» по связи с терапевтом и его доступу |
| `shared/src/exercises/` | `exerciseCatalog`: каталог упражнений — рубрика и срок для библиотеки, шапок упражнений, «Поставить цель» и «Инструментов» |
| `shared/src/flashcard/` | контент карточки схемы: режимы, потребности, шаги; `flashcardNames` — одно имя карточки «Мне плохо», число шагов и ритм дыхания (тест-сверка) |
| `shared/src/history/` | CTA «Записаться» в истории; линия недели — `sparkline.ts` (`weekWindow`, `sparklineGeometry`: одна кривая у строки «Недели» и листа «Динамика потребности», пустой день — разрыв, не ноль; `sparkRuns`, `sparkMarks` — отрезки и одиночные дни); `needTrend.ts` — направление и «к предыдущей неделе» по окну недели (нет прошлой недели — строки сравнения нет); `wheelCenter` — индекс в центре колеса |
| `shared/src/hooks/` | useYsqTest и YSQ-скоринг, `ysqProgressStore` (незаконченный тест YSQ: запись прогресса + событие окну — «Продолжить (N из 116)» без перезагрузки), useConfetti, useLongPress, useDragReorder, `useConfirmedAction` (действие только после подтверждения), `useHorizontalSwipe` (свайп трекера; касание внутри `[role="group"]` — шкала — не листает) |
| `shared/src/host/` | абстракция хоста: telegram, max, web (`getHost`, safezone) |
| `shared/src/journey/` | «Мой путь»: лента активности, периоды, детали |
| `shared/src/limits/` | `textLimits`: зеркало лимитов длины текста бэка |
| `shared/src/map/` | «Карта себя»: вью-модель и входы |
| `shared/src/mode/` | режимы: карточки, тест, подсказки, пояснения потоков |
| `shared/src/modeMap/` | контуры фигур карты режимов |
| `shared/src/needs/` | тексты и цвета пяти потребностей (`needData`), индекс дня (`dayIndex.ts` — одна формула для главной, трекера и сигнала моста), `indexDelta.ts` (`fmtIndexDelta`, `deltaSign` — разница индекса текстом и знаком цвета), `ratingShare` — доля оценки для длины столбика и штриха |
| `shared/src/notes/` | типы карточек-заметок схем и режимов; `useSavedNoteValues` — опросник карточки грузит сохранённое, а не открывается пустым; `noteTags` — темы заметки к дню (id → подпись), один список для листа заметки и «Истории» |
| `shared/src/onboarding/` | согласия первого входа, пояснения онбординга |
| `shared/src/pair/` | механика «пара»: тексты, вью, карточка партнёра |
| `shared/src/pattern/` | «Паттерны»: мета, статус, мои карточки, шаринг |
| `shared/src/phraseCheck/` | «Критик или забота?»: критерии, вердикт, состояние |
| `shared/src/portrait/` | «Мой портрет»: данные, тексты, `useAboutMe` |
| `shared/src/practices/` | дыхание, быстрые практики, шаги и футеры |
| `shared/src/prefs/` | `uiPrefsSync`: синхронизация настроек экранов с сервером |
| `shared/src/quickActions/` | меню «+»: реестр, порядок, скрытые, drag |
| `shared/src/quiz/` | `quizEngine`: мини-тесты, подсчёт результата на клиенте |
| `shared/src/schema/` | шаги и пояснения дневника схем, черновик |
| `shared/src/schemaTherapy/` | контент схем и режимов (`schemaTherapyData`), типы |
| `shared/src/screens/` | `screenBlocks`: порядок блоков экранов |
| `shared/src/selfHelp/` | текст «Важное о самопомощи» |
| `shared/src/settings/` | константы уведомлений, тексты, выбор ты/вы |
| `shared/src/share/` | карточки шаринга (canvas), тексты, события шаринга |
| `shared/src/tasks/` | `taskProgress`: прогресс стрик-задач; `taskTitle`: название задания по `type`/`text` (id схемы/режима → «Карточка режима: …») — единственный резолвер обеих площадок и обеих сторон; `taskRoute`: что открывает задание по тапу (одна маршрутизация «Сегодня», «Практики» и «Помощи»); `taskStatus`: статус задания у терапевта (`done`/`failed`/`overdue`/`soon`/`active`) для карточки клиента и доски; `assignCopy`: что форма «Новое задание» обещает терапевту (онлайн- и офлайн-клиент); `taskPayload`: текст, который форма сохраняет в задание (со склонением) |
| `shared/src/test-support/` | `rtlCleanup`, `settleUnmountTimers` для тестов |
| `shared/src/theme/` | `tokens.css`, `fonts.css`, `utilities.css`; `entityHue` (оттенки доменов, групп режимов, потребностей); `entityLook` — вид сущности: оттенок бумаги, ключ знака и сцена «готово» (`ENTITY_LOOK`, `MODE_GROUP_SIGN`, `domainLook`/`needLook`/`modeGroupLook`), таблицы «что → сущность» — `entityLookMaps` (тип записи пути, быстрое действие, задание, таблица переноса, достижения, исходы служебных страниц), допустимые оттенки бумаги и ключи знаков — `signKeys` |
| `shared/src/therapy/` | `bridge/` — «мост к терапевту» клиента (`therapySignal`, `therapyBridgeLinks`, `therapyBridgeTexts`, `therapyBridgeState`); кабинет терапевта: join, карточка клиента обоих фронтов (`useNoteComposer` — «Новая заметка», `useSessionAliasEditing` — даты сессий и имя, `reloadClientTasks`, `useTherapistTaskActions` — удаление и отметка задания терапевтом, `sessionInput` + `SessionDateTimeFields` — ввод дня и необязательного времени сессии по местному дню, `clientSheetHelpers.isActiveToday` — «активность сегодня» по календарю клиента из `daysSinceActive`; `clientActivity.clientActivityLabel` — одна подпись давности «активность вчера / 24 окт» для «Сегодня» и списка клиентов; `clientInitials` — подпись `clientDisplayName` («Без имени · 123» у клиента без имени; бэкенд доски заданий — копия `src/therapy/client-display-name.ts`) и инициалы аватара `clientAvatarInitials` во всём кабинете), концептуализация (`conceptOverLimit` — какое поле длиннее предела сервера), `conceptGraph`, `ysqExpression` (выраженность схем YSQ у терапевта по флагу `active` бэкенда, порядок как у клиента), `upcomingSession` (ближайшая сессия клиента: прошедшая `nextSession` → ближайший день встреч, `isSessionToday` — встреча сегодня у смотрящего; кабинет терапевта и «Встреча с терапевтом» у клиента — баннер «Практик», `profile/TherapistCard`, `helpSection/NextSessionBanner`) |
| `shared/src/today/` | `useDayRatings` — оценки дня |
| `shared/src/utils/` | addressForm(+Cache), format (`todayStr` — местный день человека; день UTC — `calendarDate.todayCalendarDate`, №25), `momentDate.momentIsToday`, storageKeys, crisisMarkers, `searchNormalize` (`matchesSearch` — поиск без регистра и «ё/е»: клиенты в списке, сайдбаре и ⌘K; им же нормализует crisisMarkers), drafts (`useDraftAutosave` — черновик формы упражнения: восстановить, автосохранить, стереть после сохранения), a11y; `usePendingSave` — единственная механика автосохранения с задержкой: правка привязана к владельцу (клиент, карта), досылка при смене владельца, `pagehide`, скрытии вкладки и размонтировании (keepalive — `shared/src/api/keepalive.ts`) |
| `shared/src/warmWords/` | «Тёплые слова»: сбор и хук |

- **Тесты:** vitest рядом с кодом, у каждого пакета свой (`npm test --prefix <пакет>`). jsdom включается директивой `// @vitest-environment jsdom` в самом файле, а не глобально.

### `game/`
- Заморожена. Отдельный пакет (Phaser 3 + Vite, `base '/game/'`), `shared/` не использует. Собирается в `Dockerfile` и копируется в `dist/game/` собранного webapp, отдаётся на `/game`.
- Исключена из гейтов размера файла и аналогичных. Не трогать без прямой просьбы. Номер телефона доверия в ней продублирован вручную (сверка тестом `src/test-support/gates/game-crisis-hotline.spec.ts`).

### Как фронт ходит в бэк
- Компонент → `api.метод()` (`webapp/src/api.ts`) → `get/post/postJson/patchJson/del` из `apiClient.ts` → `authedFetch` → `fetchWithTimeout` (15 с) → `${BASE}/api/...`.
  - `BASE` берётся из `VITE_API_URL`; пусто означает тот же origin.
  - В dev у webapp vite проксирует `/api` на `localhost:3000` (`webapp/vite.config.ts`).
  - Бэкенд — NestJS в `src/`; он же раздаёт собранный webapp на `/` и игру на `/game`; `/app/*` → 302 на `/today`.
- Авторизация: `Authorization: Bearer` плюс `credentials:'include'` для refresh-куки; внутри Telegram/MAX, пока токена нет, — заголовок хоста (`x-telegram-init-data` / `x-max-init-data`). 401 → один refresh и повтор запроса.
- GET кешируются (дедуп и stale-while-revalidate, `shared/src/api/apiCache.ts`). Мутации инвалидируют кеш по `shared/src/api/apiCacheRules.ts`. `/api/auth/*` в кеш не попадают.
- Аналитика: `api.trackEvent(name, meta)` → `POST /api/event`, fire-and-forget, ошибки глотаются (`shared/src/api/sharedApi.ts`).
  - Для анонимов есть `api.trackPublicEvent` → `/api/public-event`.
  - Имена событий — allow-list на бэке `src/analytics/analytics.constants.ts`; типы и константы на фронте — `shared/src/share/analytics.ts`.
- Ошибки клиента: `reportClientError` (`createClientErrorReporter(BASE, 'webapp')`, `shared/src/api/clientErrorReport.ts`).

### Подводные камни
1. **`shared/` не должен импортировать фронт-специфику** (`../api`, роутер и т.п.). Зависимости передаются параметрами: `createRatingApi(authedFetch, trackEvent)`, `useAddressFormValue(loadForm)`, `buildSharedApi(transport)`.
   - `api.trackEvent` внутри `ratingApi` вызывается лениво (замыкание), иначе TDZ.
2. **Токены и CSS.** Общие токены (акцент, шрифты Manrope + Spectral, шкалы `--r-*`, `--space-*`, класс `.skel`) лежат в `shared/src/theme/tokens.css` и импортируются первой строкой `webapp/src/index.css`. Остальное (`--bg`, `--surface`, цвета текста и статусов, тема) — в нём же.
   - Гейт `scripts/check-token-contract.mjs` сверяет только набор имён токенов, не значения.
   - `var(--x, fallback)` запрещён.
   - `shared/src/theme/utilities.css` подключается в `webapp/src/main.tsx` строго после `index.css`.
   - В webapp светлая тема кабинета фиксируется классом `.light-lock` (`webapp/src/index.css`); тёмная для кабинетов не нарисована.
3. **webapp — два сайта в одном бандле:** выбор `personalRoutes` или `appRoutes` делается один раз при загрузке модуля `webapp/src/App.tsx` по хосту или `?site=personal`.
   - Правки `<head>` и фавиконок для визитки делает `webapp/src/utils/domainChrome.ts` из JS (`webapp/index.html` один на оба домена).
   - Новый раздел кабинета требует правок в `appRoutes` (роут с `element: null`) и в `webapp/src/components/appShell/navigation.ts`, а не только компонента.
