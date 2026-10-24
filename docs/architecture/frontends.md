# Карта: фронтенды — webapp, schema-miniapp, shared, game

> Подробности к [docs/ARCHITECTURE.md](../ARCHITECTURE.md). Читай раздел нужной площадки
> (`grep -n '^### ' docs/architecture/frontends.md`), а не весь файл. Карта врёт или
> молчит — исправь строку в том же PR и запиши промах в [docs/agent/NAV_LOG.md](../agent/NAV_LOG.md).

### `webapp/` (сайт schemehappens.ru + визитка kotlarewski.*, JWT)
- **Вход:** `webapp/src/main.tsx` подключает `webapp/src/index.css`, затем `shared/src/theme/utilities.css` (порядок важен), ставит `installChunkReloadListener()` и рендерит `App`.
- **Роутинг:** все роуты в `webapp/src/App.tsx` (react-router-dom 7, `createBrowserRouter`), отдельного файла роутов нет. Два набора роутов, выбор по `isPersonalSite`:
  - `personalRoutes` — визитка практики: хост `kotlarewski.*` (`isPracticeHost`, `webapp/src/utils/domainChrome.ts`) или `?site=personal`. Роуты: `/`, `/articles`, `/reviews`, `/admin`, `/book`, `/booking/paid|manage`, `/subscribe`, `/donate`, `/privacy`, `/offer`. Продукта «Всё по схеме» здесь нет, сессия не поднимается (`AuthProvider bootstrapSession={!isPersonalSite}`).
  - `appRoutes` — продукт: лендинг, `/tests`, `/login`, `/auth/*`, `/link`. Юрстраницы `/privacy` и `/offer` — в обоих наборах: на них ведут вход, согласие, подвалы и мини-апп; карта сайта сверяется с `appRoutes` (`src/articles/sitemap.middleware.spec.ts`). Закрытая часть идёт через layout `RequireAuth` → `/account`, `/account/merge` и `AppShell`.
- **Разделы кабинета:** роуты `/today /diary /schemas /profile /practice /cabinet[/:clientId]` заданы с `element: null`. Реально разделы рисует `webapp/src/components/AppShell.tsx` по `sectionFromPath` (`webapp/src/components/appShell/navigation.ts`, тип `Section = today|diary|schemas|profile|practice`) через `webapp/src/components/appShell/AppSections.tsx`. Оверлеи: `webapp/src/components/appShell/useOverlays.ts`, `webapp/src/components/appShell/AppOverlays.tsx`, `webapp/src/components/appShell/EntryFlows.tsx`.
- **Каталоги:**
  - `webapp/src/pages/` — страницы-роуты (`LoginPage`, `AccountPage`, `AdminPage` (lazy), `Booking*`, `Donate`, `Subscribe`, `Articles`, `LandingPage` и `ProductLandingPage`; подпапки `tests/`, `login/`, `admin/` и т.д.).
  - `webapp/src/sections/` — экраны кабинета: `Today`, `Diary`, `Schemas`, `Practice`, `Profile`, `TherapistToday` (+ подпапки).
  - `webapp/src/components/` — весь остальной UI: шторки и оверлеи, `Dialog`, `Skeleton`, `booking/`, `therapist/`, `modeMap*`, `landing-kit.tsx`, `appShell/`.
  - `webapp/src/hooks/` — `useHistorySheet`, `useHostBackButton`, `useHostShell`, `useHostSafeTop`, `useAsyncData`, `useQuizRunner`, `useGoogleOneTap`, `useIsOffline`, `useOutboxFlushOnOnline`.
  - `webapp/src/utils/` — `addressForm.ts`, `AddressFormProvider.tsx`, `apiBase.ts`, `domainChrome.ts`, `theme.ts`, `uiPrefsSync.ts`, `chunkReload.ts`; часть файлов — реэкспорты из shared.
  - `webapp/src/auth/` — `AuthProvider`, `authContext`, `refreshSession` (refresh-кука и кросс-табный замок), `telegramWebAppAuth`, `loginConsent`, `clearLocalData`.
  - `webapp/src/host/` — поведение внутри WebView Telegram/MAX: `initHost`, `ExternalLink`, `useHostId`. Само определение хоста лежит в `shared/src/host/`.
  - `webapp/src/styles/` — 34 css по экранам и шторкам. `webapp/src/index.css` сам импортирует только `cabinet.css` и `touch-fixes.css`, остальные подключаются из компонентов (`import '../styles/…css'`).
  - `webapp/src/lib/` — Метрика (`metrika*.ts`, `webvisorRoutes.ts`) и `tone.ts` (оттенки разделов).
  - `webapp/src/legal/` — `operator.ts`: реквизиты оператора (оферта, политика, футер визитки).
  - `webapp/src/share/` — кнопки и шторка шаринга (`DayShareButton`, `DiaryShareButton`, `ShareCardSheet`, `SharePillButton`, `TherapistInviteShare`).
  - `webapp/src/security/` — только тест-инвариант XSS (`xss.invariants.test.ts`).
  - `webapp/src/assets/` — `hero.png`, `vite.svg`.
  - `webapp/src/test-support/` — `mockCanvas2d.ts`, `renderWithFlow.tsx`, `rtlCleanup.ts`.
  - `webapp/public/` — `fonts/`, иконки и favicon, `manifest.webmanifest`, `theme.js` (тема до первого кадра, из-за CSP не инлайн), `telegram-web-app.js`, `max-bridge.js`, `robots.txt`, `llms.txt`, файлы верификации Яндекса.
  - Прочее в `webapp/src/`: `api.types.ts` и реэкспорты-заглушки (`needData.ts`, `haptic.ts`, `types.ts`).
- **API-клиент:**
  - `webapp/src/apiClient.ts` — HTTP-слой: `authedFetch`, `get/post/postJson/patchJson/del`, `ApiError`.
  - `webapp/src/api.ts` — доменные методы (объект `api`).
  - Админка (`adminReq`) ходит мимо JWT, с заголовком `x-admin-key`.
- **Токены:**
  - Access-токен лежит в памяти (state в `AuthProvider`, в localStorage его нет).
  - `TokenBridge` в `webapp/src/App.tsx` передаёт его в `setTokenProvider` и `setRefreshHandler`.
  - Refresh — httpOnly-кука: `POST /api/auth/refresh` с `credentials:'include'` и `x-requested-with: webapp` (`webapp/src/auth/refreshSession.ts`).
- **ты/вы:**
  - Инфраструктура одна, в `shared/src/utils/addressForm.ts`: `AddressFormContext`, `useAddressForm`, `useSetAddressForm`, `useTr()` (`tr('текст на ты','текст на вы')`), `pickForm`.
  - `webapp/src/utils/addressForm.ts` — реэкспорт.
  - `webapp/src/utils/AddressFormProvider.tsx` грузит `api.getSettings().addressForm` через `shared/src/utils/addressFormCache.ts` (`useAddressFormValue`). Старт идёт из localStorage `address_form`, чтобы не было вспышки «ты».
  - Провайдер и `webapp/src/components/AddressFormPicker.tsx` смонтированы внутри `RequireAuth`. Публичные страницы получают дефолт `'ты'` из контекста.
  - Логика пикера — `shared/src/settings/useAddressFormChoice.ts` и `shared/src/settings/addressFormPrompt.ts`.
- **`useHistorySheet`:** `webapp/src/hooks/useHistorySheet.ts`, стек листов в `webapp/src/hooks/historySheetStack.ts`, реестр открытых — `webapp/src/hooks/openSheets.ts`.
  - Хук делает `navigate()` через react-router и кладёт стек id в `location.state.__sheetStack`. Прямой `history.pushState` запрещён.
  - Лист закрывается, когда его id пропал из стека. Escape закрывает верхний лист. Возвращаемый `goBack` используется для всех закрытий листа.

### `schema-miniapp/` (Telegram/MAX mini app, `/app/`, initData-аутентификация)
- **Вход:** `schema-miniapp/src/main.tsx`:
  - `ensureHostOwner()` и редирект установленного PWA на десктопе в кабинет (`schema-miniapp/src/utils/desktopLaunch.ts`);
  - дальше `ErrorBoundary` → `AddressFormProvider` → `App`, плюс `UpdateToast` и `PerfHud`.
  - `schema-miniapp/src/App.tsx` — 660 строк, на файл действует храповик размера (`scripts/check-file-size-ratchet.mjs`: рост запрещён, выноси в `hooks/` и `utils/`).
- **Навигация без роутера:**
  - Секции — `useState<Section>`: `today | help | schemas | profile`. Стартовая берётся из `?section=` или localStorage (`schema-miniapp/src/utils/defaultSectionKey.ts`). Нижнее меню — `schema-miniapp/src/components/BottomNav.tsx`, рендерится из `schema-miniapp/src/components/AppDiaryNav.tsx`. У терапевта вместо него `TherapistBottomNav` и состояние `cabinetView: 'list'|'client'`.
  - Секции ленивые: `schema-miniapp/src/components/LazySections.tsx`, `schema-miniapp/src/utils/sectionLoaders.ts`, `schema-miniapp/src/utils/preloadSections.ts`, `KeepMountedSection`. Есть свайп между вкладками (`schema-miniapp/src/hooks/useSectionSwipe.ts`).
  - Шторки и оверлеи: реестр `schema-miniapp/src/hooks/useSheets.ts` (редьюсер, порядок открытия `openOrder`). Список ключей — `OVERLAY_SHEET_KEYS` в `schema-miniapp/src/hooks/anyOverlayOpen.ts`. Пока оверлей открыт, секции получают `inert`, свайп выключен.
  - «Назад»: `schema-miniapp/src/hooks/useHostBackButton.ts` берёт верхний лист (`topOverlayKey`, `schema-miniapp/src/hooks/sheetsStack.ts`) и закрывает его тем же closer'ом, что и крестик (`schema-miniapp/src/hooks/overlayClosers.ts`, `buildOverlayClosers`). Новый ключ в `OVERLAY_SHEET_KEYS` без записи в closers не компилируется.
  - Локальные оверлеи внутри листа (например чек-ин) ставят слой через `schema-miniapp/src/hooks/backLayers.ts` (`pushBackLayer` / `useBackLayer`); он закрывается раньше листа.
  - У web-хоста своей кнопки «Назад» нет: роль играет история браузера через `schema-miniapp/src/hooks/useHostHistoryBack.ts` (прямой `pushState` и `popstate`, react-router в miniapp нет).
- **Каталоги:**
  - `schema-miniapp/src/components/` — UI, шторки, `Skeleton`, `Lazy*`.
  - `schema-miniapp/src/sections/` — `Today`, `Help`, `Schemas`, `Profile`, `Diary` и подпапки.
  - `schema-miniapp/src/hooks/` — шторки, «Назад», онбординг-гейт, outbox, свайп.
  - `schema-miniapp/src/utils/` — константы и загрузчики секций, перф-лог, safezone, storageKeys, тема.
  - `schema-miniapp/src/share/` — шторка и кнопки шаринга, `cards/`.
  - `schema-miniapp/src/test-support/` — `App.test-fixtures.ts`, `App.test-helpers.tsx`, `mockApi.ts`, `rtlCleanup.ts`.
  - В корне `schema-miniapp/src/`: `api*.ts`, `session*.ts`, `sw.ts`, `registerServiceWorker.ts`, `logout.ts`, `useUserFlags.ts`.
  - Страниц (`pages/`) и `auth/` нет; вместо `auth/` — `session*.ts`.
- **API-клиент:** `schema-miniapp/src/apiClient.ts` (зеркало webapp-версии), доменные методы в `schema-miniapp/src/api.ts` и `schema-miniapp/src/apiExercises.ts`, типы в `schema-miniapp/src/apiTypes.ts`.
- **Сессия** (`schema-miniapp/src/session.ts`, `schema-miniapp/src/sessionRenew.ts`):
  - `authHeaders()` отдаёт `Authorization: Bearer`, если токен свежий. Иначе берёт заголовок хоста из `getHost().authHeaders()`: `x-telegram-init-data` (Telegram), `x-max-init-data` (MAX), для web-хоста пусто.
  - initData один раз меняется на access (в памяти, ~15 мин) + refresh-куку через `getHost().sessionExchange()` (например `/api/auth/telegram/webapp`).
  - На 401 один раз выполняется `renewSession` и запрос повторяется.
- **Сборка** (`schema-miniapp/vite.config.ts`):
  - `base: '/app/'`, плагин `VitePWA` в режиме `injectManifest` (`schema-miniapp/src/sw.ts`).
  - Имена ассетов без хеша (`[name].js` в `schema-miniapp/dist/assets/`).
  - `schema-miniapp/dist/` закоммичен. Команда: `npm run build --prefix schema-miniapp`, затем коммит `dist`.
  - `Dockerfile` не собирает мини-апп, а копирует `schema-miniapp/dist/` в `dist/app/` собранного webapp; `.dockerignore` исходник мини-аппа исключает.
  - CI-джоба `miniapp` (`.github/workflows/ci.yml`) пересобирает и падает, если `schema-miniapp/dist` не совпал с коммитом; инварианты имён проверяет `src/test-support/gates/miniapp-dist.spec.ts`.
  - При слиянии драйвер `scripts/merge-miniapp-dist.mjs` гасит конфликт `dist`, а хук `post-merge` (ставит `scripts/setup-merge-drivers.mjs`) пересобирает его.
  - `schema-miniapp/src/registerServiceWorker.ts` сейчас не регистрирует SW, а снимает установленный и чистит кеши (эксперимент 2026-08-25, см. шапку файла).

### `shared/`
- **Что здесь:** единственная копия общего кода обоих фронтендов — типы, чистая логика, хуки, тексты и контент, общие компоненты, CSS-токены.
  - Корневые файлы: `shared/src/types.ts`, `shared/src/apiTypes.ts`, `shared/src/userId.ts` (id может быть строкой больше 2^53).
  - Правило №3: новый общий код сразу сюда, а не копипастой.
- **Как подключается:**
  - Не собирается сам и не npm-пакет: фронты импортируют относительными путями `../../shared/src/...` (например `schema-miniapp/src/main.tsx` импортирует `shared/src/host/`, `shared/src/auth/`, `shared/src/theme/utilities.css`).
  - В vite нужны `server.fs.allow: ['..']` и `resolve.dedupe: ['react','react-dom']`.
  - Свои `shared/package.json` и `shared/vitest.config.ts` только для тестов.
- **Общий API:**
  - `shared/src/api/sharedApi.ts` — `buildSharedApi(transport)`. `ApiTransport = {get, post, postJson, del}`, транспорт даёт `apiClient.ts` своего фронта.
  - `createRatingApi(authedFetch, trackEvent)` (`shared/src/api/ratingApi.ts`) — оценки с оффлайн-outbox.
  - `createPracticeSessionsApi(transport)` (`shared/src/api/practiceSessionsApi.ts`).
  - В обоих `api.ts`: `export const api = { ...buildSharedApi(transport), ...ratingApi, ...createPracticeSessionsApi(transport), …локальные методы }`.
  - Локальное: у webapp — booking, articles, admin, therapy и др.; у miniapp — `...exercisesApi` и другое.
  - Новый метод, нужный обоим фронтам, добавляется в `sharedApi.ts`.
- **Вокруг API:** кеш GET (`shared/src/api/apiCache.ts`, `shared/src/api/apiCacheRules.ts`, `shared/src/api/apiCacheRules.data.ts`), `readJsonBody`, `readErrorBody`, `humanizeError` (текст ошибки для экрана: лимит, авария, сеть, служебный английский → запасной текст), `clientErrorReport`.

**`shared/src/*` — подкаталоги (44):**

| dir | что внутри |
|---|---|
| `shared/src/about/` | тексты «Зачем это всё» и пяти потребностей |
| `shared/src/account/` | ссылки аккаунтов, удаление с TOTP, экспорт данных |
| `shared/src/analytics/` | трекинг показа кризисной карточки |
| `shared/src/api/` | фабрики api, кеш GET, разбор ответов и ошибок |
| `shared/src/auth/` | refresh сессии, кросс-табный замок, владелец данных, тикет входа |
| `shared/src/booking/` | часовой пояс клиента, канал связи, региональная цена |
| `shared/src/build/` | vite-плагин `requireBotUsername` |
| `shared/src/case/` | поток «Что это было»: типы, состояние, сохранение |
| `shared/src/childhoodWheel/` | колесо детства: данные и примеры |
| `shared/src/components/` | общие компоненты: CrisisCard, Celebration, TherapyNote, Ysq*, ConnectionTrouble |
| `shared/src/diary/` | мета дневников, пояснения, благодарности |
| `shared/src/flashcard/` | контент карточки схемы: режимы, потребности, шаги |
| `shared/src/history/` | CTA «Записаться» в истории |
| `shared/src/hooks/` | useYsqTest и YSQ-скоринг, useConfetti, useLongPress, useDragReorder |
| `shared/src/host/` | абстракция хоста: telegram, max, web (`getHost`, safezone) |
| `shared/src/journey/` | «Мой путь»: лента активности, периоды, детали |
| `shared/src/limits/` | `textLimits`: зеркало лимитов длины текста бэка |
| `shared/src/map/` | «Карта себя»: вью-модель и входы |
| `shared/src/mode/` | режимы: карточки, тест, подсказки, пояснения потоков |
| `shared/src/modeMap/` | контуры фигур карты режимов |
| `shared/src/needs/` | тексты и цвета пяти потребностей (`needData`) |
| `shared/src/notes/` | типы карточек-заметок схем и режимов |
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
| `shared/src/tasks/` | `taskProgress`: прогресс стрик-задач |
| `shared/src/test-support/` | `rtlCleanup`, `settleUnmountTimers` для тестов |
| `shared/src/theme/` | `tokens.css`, `fonts.css`, `utilities.css` |
| `shared/src/therapy/` | кабинет терапевта: join, заметки, концептуализация, `conceptGraph` |
| `shared/src/today/` | блоки «Сегодня», фокус, кастомизация |
| `shared/src/utils/` | addressForm(+Cache), format, storageKeys, crisisMarkers, drafts, a11y |
| `shared/src/warmWords/` | «Тёплые слова»: сбор и хук |

- **Тесты:** vitest рядом с кодом, у каждого пакета свой (`npm test --prefix <пакет>`). jsdom включается директивой `// @vitest-environment jsdom` в самом файле, а не глобально.

### `game/`
- Заморожена. Отдельный пакет (Phaser 3 + Vite, `base '/game/'`), `shared/` не использует. Собирается в `Dockerfile` и копируется в `dist/game/` собранного webapp, отдаётся на `/game`.
- Исключена из гейтов размера файла и аналогичных. Не трогать без прямой просьбы. Номер телефона доверия в ней продублирован вручную (сверка тестом `src/test-support/gates/game-crisis-hotline.spec.ts`).

### Как фронт ходит в бэк
- Компонент → `api.метод()` (`webapp/src/api.ts` или `schema-miniapp/src/api.ts`) → `get/post/postJson/patchJson/del` из `apiClient.ts` → `authedFetch` → `fetchWithTimeout` (15 с) → `${BASE}/api/...`.
  - `BASE` берётся из `VITE_API_URL`; пусто означает тот же origin.
  - В dev у webapp vite проксирует `/api` на `localhost:3000` (`webapp/vite.config.ts`).
  - Бэкенд — NestJS в `src/`; он же раздаёт собранный webapp на `/`, мини-апп на `/app/` и игру на `/game`.
- Авторизация: webapp — `Authorization: Bearer` плюс `credentials:'include'` для refresh-куки; miniapp — Bearer, а если токена нет, заголовок хоста (`x-telegram-init-data` / `x-max-init-data`). 401 → один refresh и повтор запроса.
- GET кешируются (дедуп и stale-while-revalidate, `shared/src/api/apiCache.ts`). Мутации инвалидируют кеш по `shared/src/api/apiCacheRules.ts`. `/api/auth/*` в кеш не попадают.
- Аналитика: `api.trackEvent(name, meta)` → `POST /api/event`, fire-and-forget, ошибки глотаются (`shared/src/api/sharedApi.ts`).
  - Для анонимов есть `api.trackPublicEvent` → `/api/public-event`.
  - Имена событий — allow-list на бэке `src/analytics/analytics.constants.ts`; типы и константы на фронте — `shared/src/share/analytics.ts`.
- Ошибки клиента: `reportClientError` (`createClientErrorReporter(BASE, 'webapp'|'miniapp')`, `shared/src/api/clientErrorReport.ts`).

### Подводные камни
1. **Парные файлы.** `scripts/check-paired-files.mjs` (список `PAIRS`) требует побайтового совпадения `webapp/src/<p>` и `schema-miniapp/src/<p>` (пути ниже относительно этих каталогов):
   - `types.ts`, `utils/{addressForm,AddressFormProvider,format,storageKeys,a11y,reducedMotion,telemetryUrl,crisisMarkers,drafts,todayInsight,therapistContact}.ts(x)`;
   - `components/CrisisCard.tsx`, `hooks/{useYsqTest,useReducedMotionPref}.ts`;
   - `components/schemaFlashcard/{constants,types}.ts`, `test-support/rtlCleanup.ts`.
   Правишь одну сторону — правь вторую в том же PR.
   - Многие из них, а также `needData.ts`, `haptic.ts`, `modeChainVm.ts`, `schemaTherapyData.ts`, — тонкие реэкспорты (1–23 строки). Логику менять в `shared/src/...`, не в заглушке.
   - Пары не по байтам, а по смыслу: `apiClient.ts`, `api.ts`, `Skeleton.tsx`, `Celebration.tsx`.
   - Раздел про «парные копии» в `shared/README.md` частично устарел: `addressForm` и `CrisisCard` теперь реэкспорты.
2. **`shared/` не должен импортировать фронт-специфику** (`../api`, роутер и т.п.). Зависимости передаются параметрами: `createRatingApi(authedFetch, trackEvent)`, `useAddressFormValue(loadForm)`, `buildSharedApi(transport)`.
   - `api.trackEvent` внутри `ratingApi` вызывается лениво (замыкание), иначе TDZ.
3. **Правка `shared/` или `schema-miniapp/src/` меняет бандл мини-аппа:** `schema-miniapp/src/main.tsx` и `schema-miniapp/src/App.tsx` импортируют `../../shared/src/...`. Нужно пересобрать `schema-miniapp/dist/`, закоммитить его вместе с исходником и не править руками.
   - В бандл нельзя класть `new Date()` и хеши: CI сверяет сборку с закоммиченным `dist`.
   - `schema-miniapp/index.html` жёстко ссылается на `/app/assets/TodaySection.js`, поэтому имена ассетов должны оставаться стабильными.
4. **Токены и CSS.** Общие токены (акцент, шрифты Manrope + Spectral, шкалы `--r-*`, `--space-*`, класс `.skel`) лежат в `shared/src/theme/tokens.css` и импортируются первой строкой `webapp/src/index.css` и `schema-miniapp/src/index.css`. Остальное (`--bg`, `--surface`, цвета текста и статусов, тема) — локально в каждом `index.css`.
   - Гейт `scripts/check-token-contract.mjs` сверяет только набор имён токенов, не значения.
   - `var(--x, fallback)` запрещён.
   - `shared/src/theme/utilities.css` подключается в `main.tsx` обоих фронтов строго после `index.css`.
   - В webapp светлая тема кабинета фиксируется классом `.light-lock` (`webapp/src/index.css`); тёмная для кабинетов не нарисована.
5. **Skeleton-примитивы двух фронтов не байт-пара и с разными пропсами:** `webapp/src/components/Skeleton.tsx` (`width`, `height`) и `schema-miniapp/src/components/Skeleton.tsx` (`w`, `h`, `circle`, `SkeletonCard/Lines/List`, `TodayScreenSkeleton`, `ScreenSkeleton`). Стиль `.skel` у обоих общий, из `shared/src/theme/tokens.css`. Правило проекта: скелетон по форме контента, не спиннер.
6. **webapp — два сайта в одном бандле:** выбор `personalRoutes` или `appRoutes` делается один раз при загрузке модуля `webapp/src/App.tsx` по хосту или `?site=personal`.
   - Правки `<head>` и фавиконок для визитки делает `webapp/src/utils/domainChrome.ts` из JS (`webapp/index.html` один на оба домена).
   - Новый раздел кабинета требует правок в `appRoutes` (роут с `element: null`) и в `webapp/src/components/appShell/navigation.ts`, а не только компонента.
