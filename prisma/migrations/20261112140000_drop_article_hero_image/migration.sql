-- Старые фото-обложки статей (heroImage: JPEG data URI из админки) больше не нужны:
-- обложки рисует сайт по slug (webapp/src/components/art/articleCoverScenes.ts, #1038),
-- API колонку не читает и не пишет с #1038. Владелец 2026-11-12: «удаляй».
-- IF EXISTS — миграция идемпотентна целиком (правило о миграциях, .claude/rules/data.md).
ALTER TABLE "Article" DROP COLUMN IF EXISTS "heroImage";
