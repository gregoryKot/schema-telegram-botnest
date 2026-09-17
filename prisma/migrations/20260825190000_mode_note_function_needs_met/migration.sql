-- Карточка режима догоняет классический бланк проработки режима: два новых
-- вопроса — «какая у режима функция» (modeFunction) и «даёт ли поведение
-- режима то, что на самом деле нужно» (needsMet). Пустая строка по умолчанию —
-- как у остальных полей UserModeNote; содержимое шифруется на уровне
-- приложения (MODE_NOTE_SCHEMA, src/bot/notes.service.ts).
ALTER TABLE "UserModeNote"
  ADD COLUMN "modeFunction" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "needsMet" TEXT NOT NULL DEFAULT '';
