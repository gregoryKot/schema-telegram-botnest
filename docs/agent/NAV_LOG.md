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
