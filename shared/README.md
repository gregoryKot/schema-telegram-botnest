# shared — единственная копия общего кода сайта

Код, нужный нескольким экранам `webapp/` или сайту вместе с бэкендом, живёт
здесь одним экземпляром (правило №3 в `CLAUDE.md`; копию механики в другом
месте ловит `scripts/check-jscpd-ratchet.mjs`). Карта подкаталогов —
[docs/architecture/frontends.md](../docs/architecture/frontends.md), раздел
«`shared/`». Новому общему коду место здесь, а не в копипасте.

## Как подключается

- Не npm-пакет и сам не собирается: `webapp/` импортирует относительными
  путями (`../../shared/src/...`). Docker-сборка сайта идёт из полного
  контекста (`COPY . .`), vite резолвит такие импорты, деплою ничего не нужно.
  Один экземпляр React на оба дерева держит `resolve.dedupe` в
  `webapp/vite.config.ts`.
- Свои `package.json` и `vitest.config.ts` — только для тестов.
- Часть файлов `webapp/src` — однострочные реэкспорты отсюда
  (`utils/format.ts`, `utils/storageKeys.ts`, `utils/addressForm.ts`,
  `components/TherapyNote.tsx`): старые пути импорта сайта продолжают работать.

## Зависимости сайта приходят параметром

`shared/src` не импортирует `webapp/src` (`../api` и подобное): нужен api,
аналитика или форма обращения — общий код принимает их аргументом, а в
`webapp/` стоит тонкая обёртка.

- `shared/src/components/CrisisCard.tsx` (`CrisisCardView`) получает `tr` и
  `track` от `webapp/src/components/CrisisCard.tsx`.
- `shared/src/utils/addressFormCache.ts` (`useAddressFormValue`) получает
  загрузку настроек от `webapp/src/utils/AddressFormProvider.tsx`; сама
  инфраструктура «ты/вы» (`useTr`, `pickForm`) — `shared/src/utils/addressForm.ts`.
- `shared/src/api/sharedApi.ts` (`buildSharedApi`) получает транспорт от
  `webapp/src/api.ts`.

Парных копий между фронтендами больше нет: мини-апп удалён (#908, #917),
игра (`game/`) из `shared/` не импортирует.
