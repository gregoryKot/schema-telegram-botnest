-- Which built-in SVG diagram an article renders (kept out of editable content).
ALTER TABLE "Article" ADD COLUMN "diagramKey" TEXT;
