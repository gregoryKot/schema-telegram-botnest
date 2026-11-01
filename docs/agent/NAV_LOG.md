# Журнал промахов навигации

> Строка — когда агенту пришлось лезть в код за тем, что должно было найтись в
> карте ([docs/ARCHITECTURE.md](../ARCHITECTURE.md)) или в правилах. Пишется в
> том же PR, где карта уже дописана, — журнал фиксирует промах, а не заменяет
> починку. Нашёл сразу — ничего не пиши. Разбирает `/retro журнал`
> ([.claude/skills/retro/SKILL.md](../../.claude/skills/retro/SKILL.md)).
>
> Только дописывать в конец: файл сливается встроенным драйвером git `union`
> (`.gitattributes`), строки двух параллельных PR не конфликтуют. Удаляет
> записи только `/retro` после разбора.

Формат одной строки:

`- ГГГГ-ММ-ДД · задача: … · искал: … · нашёл: `путь` · дописал: `файл`` — или
`· устарело: что врала карта` вместо «дописал».

## Записи

- 2026-10-21 · задача: проверка субагента `scout` («где обрабатывается пауза уведомлений») · искал: обработчик кнопки «⏸ Пауза» · нашёл: `src/telegram/telegram.notify-actions.service.ts` · дописал: `docs/architecture/backend-core.md` (раздел `src/notification/`), `docs/architecture/glossary.md` (строка «⏸ Пауза»)
- 2026-10-22 · задача: сообщение клиенту о бывшем терапевте · искал: где читается «Мой терапевт» и кто ставит `ended` · нашёл: `src/therapy/therapy-relation-info.ts`, `webapp/src/sections/profile/TherapistCard.tsx`, `schema-miniapp/src/components/settingsSheet/TherapistClientSection.tsx`; `ended` ставит ещё дедуп-миграция `20261016100000_active_relation_unique` · дописал: `docs/architecture/glossary.md` (строка «Мой терапевт»), `docs/architecture/backend-platform.md` (входы `src/therapy/`)
- 2026-10-22 · задача: «Удалить результаты теста» стирает итог, историю и прогресс · искал: кнопку «Удалить результаты теста» (в glossary нет, строки «Настройки» и «Тест на схемы» про неё молчат) · нашёл: `webapp/src/components/settingsSheet/DataSection.tsx`, `schema-miniapp/src/components/settingsSheet/DataOverlays.tsx` · дописал: `docs/architecture/glossary.md` (строка «Конфиденциальность», «Удалить результаты теста»; пометка в «Тест на схемы»)
- 2026-10-22 · задача: таймаут запроса к БД (долгие запросы `/stats`) · искал: агрегаты отчёта «Главные цифры» и воронку удержания · нашёл: `src/bot/bot.admin-stats.service.ts` · дописал: `docs/architecture/glossary.md` (строка `/stats`)
- 2026-10-26 · задача: редизайн клиентского приложения с сайта («трекер / что случилось / дневник») · искал: что такое «апп, который скачивается с сайта», где роли клиент/терапевт, есть ли трекер настроения · нашёл: `webapp/public/manifest.webmanifest`, `docs/PWA_PLAN.md`, `prisma/schema.prisma` (`UserRole`), `webapp/src/components/AppShell.tsx` (режим по URL); трекера настроения нет · дописал: `docs/architecture/glossary.md` (строки «Приложение с сайта», «версия для клиента», «трекер настроения»)
- 2026-10-27 · задача: этап 1 простого клиента (три вкладки вместо пяти, «Ещё», главная тремя плитками) · искал: где задаются вкладки сайта и что ещё перечисляет разделы · нашёл: `webapp/src/components/AppShell.tsx` (`NAV_ITEMS`), `webapp/src/components/CommandPalette.tsx` (свой `Section` и список), `webapp/public/robots.txt` и `webapp/src/lib/metrikaRoutes.test.ts` (новый роут `/more` надо классифицировать) · дописал: `docs/architecture/frontends.md` (где живут вкладки), `docs/architecture/glossary.md` (карта молчала про вкладки сайта)
- 2026-10-27 · задача: этап 2 простого клиента (трекер «один вопрос на экран») · искал: какой контрол оценки у трекера сайта (концепт называл `NeedRatingBar`) · нашёл: `webapp/src/components/NeedScale.tsx` — на сайте контрол `NeedScale`, `NeedRatingBar` только у мини-аппа · дописал: `docs/design/CLIENT_SIMPLE_2026-10.md` (устарело: две строки про `NeedRatingBar`), `docs/architecture/glossary.md` (строка «Трекер потребностей»)
- 2026-10-27 · задача: этап 4 простого клиента («Что случилось» в 3 шага, маркер `fromCase`) · искал: где взять имя режима с заглавных обоих слов («Уязвимый Ребёнок») для заголовка итога · нашёл: `modeDisplayName`/`modeClinicalName` (`shared/src/mode/`) отдают человеческую фразу ворот («Одиноко, страшно, грустно»), а не название; название — `getModeById(id).name` (`shared/src/schemaTherapy/schemaTherapyData.ts`) · дописал: `docs/architecture/glossary.md` (строка «Что это было» — состав нового потока), здесь
- 2026-10-28 · задача: отзыв терапевта по концептуализации (шум, схема целиком, сохранение, схемы у режимов, #879) · искал: где живёт «концептуализация» с видами «Схема/Поля» и что владелец называет «картой режимов» · нашёл: `webapp/src/components/therapist/ClientConceptTab.tsx`, `concept/ConceptPickers.tsx`; «карта режимов» — три места: холст `ModeMapCanvas.tsx`, карточка в «Полях», справочник `webapp/src/sections/schemas/ModeMap.tsx`; glossary знал только вкладку и холст · дописал: `docs/architecture/glossary.md` (строка «Концептуализация»: виды, связь режим↔схема, статус сохранения)
- 2026-10-29 · задача: «шум везде» и «нет схем в разделе карта режимов» (#885) · искал: что владелец называет «разделом карта режимов» · нашёл: вкладку-холст `webapp/src/components/ModeMapCanvas.tsx`, а не справочник `webapp/src/sections/schemas/ModeMap.tsx`; шум нашёл не чтением кода, а скриншотами кабинета на стабе API (`e2e-browser/support/stubApi.ts` + роль терапевта) · дописал: `docs/architecture/glossary.md` (строка «Карта режимов с терапевтом»)
- 2026-10-31 · задача: слияние `origin/main` в ветку QA-починок (день дневника, кабинет терапевта) · искал: где на сайте «сегодня» дневника после удаления `FocusEntrySheet`/`useTodayData.done` (#872) · нашёл: `webapp/src/sections/today/todayFeed.ts` (`buildDiaryFeed`, `casesTodayCount`) · дописал: строка `shared/src/therapy/` в `docs/architecture/frontends.md` (устарело: `today/TodayAside` удалён в #872)
