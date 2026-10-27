# План: одна версия вместо двух фронтендов

Дата: 2026-10-17. Статус: в работе (этап 1 — #755 и #756; дальше этап 2). Решение владельца 2026-10-17:
от приложения в Telegram отказываемся постепенно, единственный фронтенд — сайт
`webapp/` в новом дизайне. Мини-апп `schema-miniapp/` живёт до переключения
адреса у бота, потом удаляется целиком.

Почему это реально сейчас: бэкенд один; сайт уже входит по подписи хоста
внутри Telegram и MAX (`webapp/src/auth/telegramWebAppAuth.ts` через
`shared/src/host`); паритет по роутам почти полный (гейт `check-feature-parity`:
один роут только у мини-аппа); Telegram-специфики в мини-аппе — кнопка «Назад»
хоста и стек слоёв. Единая версия снимает целый класс правил и гейтов,
существующих только из-за двух фронтов: парные файлы (№3), паритет (№16),
коммит `dist`, merge-драйвер `miniapp-dist`, джоба `miniapp`.

Инвентаризация 2026-10-17 (агент, сверка по экранам, а не по `api.*`):
по API пробелов нет, различия только на уровне экранов. Часть «возможностей»
мини-аппа мертва и не переносится: `WeeklyQuestion` (не рендерится,
`App.tsx:104`), `PairSheet` (никто не открывает, пара живёт в `PartnerSection`),
баннеры «вчера не заполнено»/YSQ/карточка пары (объявлены, не показываются),
`UpdateToast` и сервис-воркер (регистрация снята экспериментом 2026-08-25),
`PerfHud`, `WebBanner`, устаревшие поля `UserFlags` (`themePref`,
`onboardingV1Done`, `trackerOnboardingDone`, `schemaIntrosShown` и др.).

## Дизайн на телефоне: правило владельца (2026-10-18)

Мини-апп — образец **во всём, кроме цвета**: раскладка, состав и порядок
блоков, шапки, строки списков, табы, «главное действие в первом экране»,
трекер в один экран. Цвета — **только нового дизайна сайта**: тёмная (`--ink`)
нижняя панель, тёмные кнопки и карточки, терракотовая «Одно дело», цветные
подложки. Терракотовые или светлые замены тёмных элементов «как в мини-аппе»
запрещены.

Откуда правило: #771–#777 скопировали у мини-аппа и раскладку, и цвета
(«туши свет» в отзыве владельца прочитано как «слишком тёмное», а значило
«всё плохо»). Раскладка владельца устроила, цвета — нет; #779 вернул цвета
нового дизайна поверх новой раскладки, #780 довёл «Сегодня» до мини-аппа.

## Этапы

Каждый пункт — отдельный PR (правило №20: один инцидент — один PR, здесь тот
же принцип), код общий с бэкендом или между экранами — в `shared/`.

### Этап 1. Сайт внутри Telegram и MAX ведёт себя как приложение

Без этого кабинет внутри мессенджера хуже мини-аппа с первого экрана.

- [x] `ready()` и `expand()` при `getHost().id !== 'web'` (мини-апп: `App.tsx:376`);
  адаптер Telegram вместе с `expand()` отключает вертикальные свайпы.
- [x] Кнопка «Назад» хоста: показывать при ненулевой глубине стека листов
  (`hooks/historySheetStack.ts`), по нажатию — `navigate(-1)`. Мост уже отдаёт
  `host.backButton` (`shared/src/host/telegram.ts`, `max.ts`).
- [x] Безопасная зона сверху: мини-апп — `utils/safezone.ts` (`useSafeTop` в 15
  местах) и переменные `--tg-*`; на сайте только `env(safe-area-inset-bottom)`.
  Шапка кабинета на весь экран уйдёт под кнопки «Закрыть» и меню Telegram.
- [x] `webapp/index.html`: тег `/max-bridge.js` (файл и тест у сайта уже есть,
  `maxBridgeLoader.test.ts`), иначе внутри MAX вход невозможен.
- [x] `MobileAppBanner` и инструкция «значок на экран» скрыты при
  `host.id !== 'web'` (внутри Telegram предлагать «есть приложение» нелепо).
- [x] Вместо них внутри мессенджера — `host.homeScreen` (`HomeScreenOfferCard`
  мини-аппа).
- [x] Внешние ссылки внутри WebView — через `getHost().openLink` (мини-апп:
  `DonateNudge`, `WebBanner`); на сайте один компонент `host/ExternalLink.tsx`.
- [x] Хаптика: хелпер звали 12 файлов сайта против 22 в мини-аппе; добавлена у
  шкалы `NeedScale`, `ModeGroupList`, навигации мастера дневника, `SelfMapScreen`,
  `CaseEntryCard` с теми же типами отклика, что в мини-аппе.

### Этап 2. Входы: ярлыки, ссылки-приглашения, бот

- [x] Серверный редирект `/app/*` → `/today` с переносом `?startapp=`,
  `?section=`, `?from=` (ярлыки старых установок и `MINIAPP_URL`). Сделан за
  env-флагом `UNIFIED_FRONTEND` (`src/unified-frontend.middleware.ts`, 302),
  по умолчанию выключен; включается на этапе 5.
- [x] Заглушка `/app/sw.js`, которая снимает себя и чистит кэши: у давно не
  открывавших мог остаться старый SW с прекэшем `/app/`. Отдаётся тем же
  middleware за флагом `UNIFIED_FRONTEND` (`src/unified-frontend.sw-stub.ts`).
- [x] Сайт читает `getHost().startParam()` (веб-адаптер уже умеет
  `?startapp=`/`?start_param=`, `shared/src/host/web.ts:77`) и показывает экран
  согласия для `pair_*`/`therapy_*` (`JoinConfirmSheet`, `joinConfirmFailText`);
  `diaries`/`tracker` — переход в раздел.
- [ ] `src/telegram/miniapp-link.ts` строит `https://t.me/<bot>/<app>?startapp=…`
  для приглашений пары и терапевта (код терапевта живёт 7 дней) — решить, куда
  ведёт ссылка после переключения; `MINIAPP_URL` по умолчанию `${APP_URL}/app/`
  (`telegram.constants.ts:19`) → кабинет. Предложение: ссылку не менять — после
  шага 2 этапа 5 она открывает кабинет внутри Telegram, а параметр запуска сайт
  уже разбирает (этап 2). Решение владельца.
- [x] Первый вход из Telegram: экран согласий («Приватность», «Не терапия») с
  уважением серверного флага `onboardingV2Done` — сейчас согласие молча
  проставляется в `appShell/useBootstrapLoad.ts:58` без дисклеймера.

### Этап 3. Содержимое, которое человек заполнил в Telegram

Самая заметная потеря при переходе: карточки и сводки, которых на сайте нет.

- [x] Лист паттерна (схема/режим): портрет-карточка, записи дневника с этим
  паттерном, справка, шаринг. Сделано: `webapp/src/components/patternSheet/*`
  (`PatternSheet`, секции карточки/помощи/записей, `ModeAboutSheet`), открывается
  из `MySchemasBlock` (со статусом строки словами) и чипов «Мои режимы»
  (`sections/SchemasSection.tsx`). Логика общая с мини-аппом: `shared/src/pattern/`
  (`patternMeta`, `patternStatus`, `patternHelpContent`, `patternShare`,
  `useMyCards`, `usePatternStatus`, `usePatternEntryDelete`; `api` приходит
  инъекцией). Отдельный список «Мои карточки» не нужен: заполненность видна по
  статусу строки. «Дополнить» открывает `SchemaEx`/`ModeEx` с уже написанным
  (`initialData`).
- [x] «Мой портрет» в профиле. Сделано: данные — `shared/src/portrait/useAboutMe.ts`
  (api инъекцией, сбои через `reportError`; мини-апп — тонкая обёртка
  `sections/profile/useAboutMe.ts`), тексты и расчёт итога/дельты —
  `shared/src/portrait/portraitTexts.ts`, порядок строк «Мои схемы/режимы» —
  `shared/src/pattern/myPatternRows.ts` (мини-апп на нём же). Сайт:
  `webapp/src/sections/profile/{PortraitCard,PortraitSheet,PortraitNeedRows,PortraitNeedBar,PortraitPatternRows,ProfileAboutBlock}.tsx`;
  строка списка открывает `PatternSheet` через `usePatternLayer` (частоты и статусы
  — оттуда же, `statusOf(kind)`). M.
- [x] Недельная частота паттернов, «паттерн недели», вводные карточки новичка
  (`PatternFrequencyList`, `WeekTopCard`, `PatternsHero`, `ModesHero`,
  `utils/patternsSummary.ts` → в `shared/`). M. Сделано: логика и тексты —
  `shared/src/pattern/{patternsSummary,weekPatternText}.ts`; сайт —
  `webapp/src/sections/schemas/{FreqMark,WeekPatternCard,PatternsIntro}.tsx`;
  мини-апп берёт то же из shared.
- [x] Карточка партнёра в паре: цвет индекса, недельные бары, «Написать»,
  подтверждение выхода. Логика одна на оба фронтенда:
  `shared/src/pair/usePairMechanics.ts` (api инъекцией), `partnerCard.ts`
  (тон индекса, фразы, столбики), `pairTexts.ts`; сайт —
  `webapp/src/components/settingsSheet/PartnerCard.tsx` + `PartnerSection.tsx`
  (старый `usePairSettings` удалён); мини-апп перешёл на shared. M.
- [x] S-пробелы (мелкие пробелы паритета):
  - [x] «Мои паттерны» и «Тёплые слова» на профиле: списки схем/режимов — в листе
    «Мой портрет» (`PortraitPatternRows`), «Тёплые слова» —
    `webapp/src/sections/profile/WarmWordsCard.tsx` (превью) → готовый экран
    `WarmWordsEx`.
  - [x] шаринг записи благодарности (`GratitudeShare`) и «Критик или забота?»
    (экран «Разобрано», `PhraseCheckShare`); [x] всех достижений
    (`webapp/src/sections/profile/AchievementsShare.tsx` в `AchievementsDialog`);
    [ ] из «Прошлых разборов» — см. README.
  - [x] прогресс стрик-цели `task.progress` (`TaskProgressBar`, расчёт —
    `shared/src/tasks/taskProgress.ts`, мини-апп на нём же).
  - [x] переход в трекер из хаба дневника (`DiaryTrackerLink`, текст —
    `shared/src/diary/diaryTrackerLink.ts`); вводная пустого хаба на сайте уже была.
  - [x] `SaveErrorNote` при провале сохранения схем/режимов: `useSaveFailure` в
    `useSchemasData`, плашка в `SchemasSection` (ты/вы).
  - [x] «Восстановить» версию концептуализации (`ConceptVersionHistory`, поля —
    `shared/src/therapy/conceptSnapshotRestore.ts`, мини-апп на нём же).
  - [x] офлайн-плашка на мобильной вёрстке (`OfflineBanner`) и повтор очереди
    оценок по `online` (`useOutboxFlushOnOnline`).
  - [x] онбординг трекера, 3 карточки (`TrackerOnboarding`, контент —
    `shared/src/needs/trackerOnboarding.ts`, мини-апп на нём же).
  - [x] развёрнутое «О приложении» (`AboutWhy`, контент — `shared/src/about/aboutData.ts`).

### Этап 4. Ежедневные точки входа

- [x] Фокус-карточка «Сегодня»: одна главная практика на выбор, «на сегодня
  всё», «Поделиться днём». Логика и тексты — `shared/src/today/todayFocus.ts`
  (ключи localStorage прежние), сайт — `webapp/src/sections/today/`
  (`TodayFocusBlock`, `TodayFocusCard`, `FocusPicker`, `FocusEntrySheet`,
  `useTodayFocusPrefs`); скрытие серии — `StreakSlot` в `TodayAside.tsx`.
  С #872 эти компоненты с главной сайта убраны (главная — три плитки и лента
  дня, см. `docs/open/frontend-ux.md`); «Фокус дня» остался в мини-аппе.
- [x] Быстрые действия «+» на телефоне. Реестр, ключи настройки и порядок
  переехали в `shared/src/quickActions/` (мини-апп берёт оттуда же; общее
  состояние листа — `usePlusMenuState`). Сайт: кнопка и лист —
  `webapp/src/components/quickActions/{PlusButton,PlusMenuSheet,QuickActions}.tsx`,
  оверлеи действий — `QuickActionOverlays.tsx` (состояние в `useOverlays`:
  `quickAction`, `runQuickAction`), разбор ⇄ карта — общий
  `caseFlow/CaseFlowHost.tsx` (на сайте его открывает плитка «Что случилось» в `TodaySection`; `CaseEntryBlock` убран в #872), настройка
  видимости — `QuickActionCustomizeSheet.tsx` (те же ключи localStorage).
  Палитра ⌘K показывает те же действия строками. Аналитика — прежние
  `plus_open`/`plus_action`/`quick_action_toggle`. Не сделано: перестановка
  пунктов на сайте и синхронизация настройки с сервером — см.
  `docs/README.md` → «Что осталось открытым».

### Этап 5. Переключение

Кода не нужно: все кнопки бота (`telegram.keyboards.ts`, `telegram.reply-helpers.ts`,
`telegram.quiz.service.ts`) и кнопка меню (`setChatMenuButton` при старте,
`telegram.service.ts`) берут адрес из `MINIAPP_URL`, а ссылки-приглашения
`t.me/<бот>/<приложение>?startapp=…` (`miniapp-link.ts`) открывают то
мини-приложение, адрес которого задан в BotFather. Шаги делает владелец в панелях,
порядок важен: сначала прямые адреса, потом редирект.

- [ ] **1. Amvera, env:** `MINIAPP_URL=https://schemehappens.ru/today`, перезапуск.
  Кнопки и меню бота ведут прямо в кабинет, без лишнего перехода через `/app/`
  (кнопка меню переставляется сама при старте). Проверка: в Telegram открыть бота →
  кнопка меню → должен открыться кабинет и войти без экрана «не удалось войти».
- [ ] **2. BotFather:** `/myapps` → приложение `MINIAPP_APP_NAME` (по умолчанию
  `diary`) → Edit Web App URL → `https://schemehappens.ru/today`. Это адрес, который
  открывают ссылки-приглашения пары и терапевта. Проверка: открыть свою же
  ссылку-приглашение из «Пары» — должен показаться лист «Присоединиться» (этап 2,
  `JoinConfirmSheet`), а не мини-апп.
- [ ] **3. MAX:** в кабинете партнёра MAX тот же адрес мини-приложения
  `https://schemehappens.ru/today`.
- [ ] **4. Amvera, env:** `UNIFIED_FRONTEND=1`, перезапуск. Включает 302 `/app/*` →
  `/today` и заглушку `/app/sw.js`: старые ярлыки на телефоне и кнопки в давних
  сообщениях бота (адрес вшит в сообщение в момент отправки) попадают в кабинет.
  Данные запуска Telegram едут во фрагменте `#tgWebAppData`, сервер его не видит,
  и браузер переносит фрагмент через редирект сам — поэтому шаги 1–2 идут первыми:
  основной поток входа вообще не проходит через редирект. Проверка: открыть кнопку
  в старом сообщении бота и старый ярлык — кабинет, вход без ошибки.
- [ ] **5. Неделя-две наблюдения:** блок «Вход в мессенджере» в `/stats`, события
  `auth_rejected`, отчёты `useAuthFailureReport`, `client-errors`. Рост отказов
  входа после шага 4 — сигнал, что фрагмент теряется на каком-то клиенте:
  откат — `UNIFIED_FRONTEND=0` (302 браузеры не кэшируют), шаги 1–2 при этом
  остаются в силе.

### Этап 6. Удаление мини-аппа

Один механический PR после этапа 5:

- каталог `schema-miniapp/` и его `dist`; Dockerfile (строка копирования в
  `webapp/dist/app/`, гейт `check-deploy-paths`); джоба `miniapp` в `ci.yml` и
  `nightly.yml`; `.gitattributes` (`merge=miniapp-dist`), `merge-miniapp-dist.mjs`,
  хук `post-merge`;
- гейты и их спеки: `check-paired-files` + `paired-files.spec`,
  `check-feature-parity` + бейслайн + спек, `miniapp-dist.spec`,
  `gate-scanner-parity.spec`; 31 скрипт со ссылкой на `schema-miniapp/src` в
  списке сканируемых деревьев;
- `MINIAPP_URL` в реестре env и `docs/ENV.md`; CORS-записи
  `*.vercel.app` в `src/main.ts`; `useDesktopAppLaunch` (`?from=app`);
- CLAUDE.md: правила №3 и №16 переписываются (парных файлов больше нет; shared
  остаётся как слой общего кода с бэкендом и между экранами), раздел
  «Мини-апп — важно» в «Деплой webapp» удаляется; `docs/PWA_PLAN.md`,
  `docs/MULTI_HOST_PLAN.md` — статус.
- 23 пары файлов: копия мини-аппа удаляется, сайтовая остаётся.

## Решения, которые нужны от владельца

1. **Тёмная тема внутри Telegram.** Кабинет только светлый (решение 2026-10-15),
   `getHost().colorScheme()` сайт не читает. Пользователь с тёмным Telegram
   получит светлое окно. Оставляем светлый или строим тёмную пару токенов (L)?
2. **Настройка экранов** (скрыть/переставить блоки «Сегодня», «Профиль»,
   «Паттерны»; 14 ключей `User.uiPrefs` на сервере, `SYNCED_PREF_KEYS`).
   На сайте раскладка двухколоночная. Переносить (L), упростить до
   «скрыть блок» или отказаться и оставить `uiPrefs` без потребителя?
3. **Куда ведёт ссылка-приглашение** `t.me/<bot>/<app>?startapp=pair_*` после
   переключения: на тот же адрес бота (Mini App открывает кабинет) или на
   `schemehappens.ru/today?startapp=…`.

## Что не переносится (мёртвый код мини-аппа)

`WeeklyQuestion`, `PairSheet`, `UpdateToast`/SW, `WebBanner`, `PerfHud`,
`useSectionSwipe` (жест, не обязателен), баннеры из `App.tsx`, устаревшие поля
`UserFlags`. После удаления запись `POST /api/user-flags` в
`feature-parity-baseline.json` исчезает вместе с гейтом; писатели флагов
`onboardingV2Done` и `childhoodWheelDone` переезжают на сайт на этапах 2 и 3.
