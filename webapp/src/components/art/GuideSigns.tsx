// Знак листа подсказок терапевту (режим, техника, раздел «Для терапевта») — тот же язык,
// что у клиента (docs/design/PAPER_2026-11.md). Какой знак у какого листа — guideSignsModel.ts;
// рисунки по ключу — guideSignDrawings.ts, та же таблица входит в общий реестр SignArt.tsx:
// одна механика «знак по ключу» на кабинет, канву шаринга и подсказки.
import type { ArtProps } from './paper';
import type { GuideSign } from './guideSignsModel';
import { GUIDE_SIGN_ART } from './guideSignDrawings';

// Знаки групп режимов переехали в GuideSignsModes.tsx; старый путь остаётся для мини-тестов
// (pages/tests/quizLook.ts) и тестовой обвязки (test-support/paperSign.tsx).
export { ChildCare, Looming, Shelter, Shield, Together, Yield } from './GuideSignsModes';

/** Знак листа подсказок по имени (guideSignsModel.ts); ключи листов — подмножество реестра SignArt. */
export function GuideSignArt({ sign, size }: ArtProps & { sign: GuideSign }) {
  const Art = GUIDE_SIGN_ART[sign];
  return <Art size={size} />;
}
