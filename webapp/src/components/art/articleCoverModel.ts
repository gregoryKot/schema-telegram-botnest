// Обложки статей: у каждой статьи своя сцена из языка знаков и своя бумага (docs/design/
// PAPER_2026-11.md, таблица «Обложки статей»). Ключ — slug: тринадцать статей сида
// (src/articles/articles.seed.ts — сверка в articleCoverModel.test.ts) и две, заведённые в
// админке. Статья без своей сцены (новая из админки) получает листы веером SceneCover по
// порядку карточки. Фото-обложек нет: растр мимо стиля (принцип 3) — картинка встроенным SVG
// на токенах. Бумага выбрана так, чтобы три соседние по дате статьи были разного оттенка.
// Отдельный файл: модули компонентов экспортируют только компоненты (react-refresh).
import type { ReactElement } from 'react';
import { CoverDepth, CoverModes, CoverRoots, CoverSchemaStacks, CoverTalkMap } from './ArticleScenesMethod';
import { CoverFirstSession, CoverGrowth, CoverScales, CoverStages } from './ArticleScenesPath';
import { CoverBar, CoverCloud, CoverMended } from './ArticleScenesHelp';
import { CoverLoop, CoverMirror, CoverOwnFrame } from './ArticleScenesSelf';

export type CoverScene = (p: { hue: number }) => ReactElement;
export interface CoverLook { Scene: CoverScene; hue: number }

/** slug → сцена и оттенок бумаги (--h). Порядок — от новых статей к старым, как в списке. */
export const ARTICLE_COVERS: Readonly<Record<string, CoverLook>> = {
  'schema-terapiya-pri-nizkoy-samootsenke': { Scene: CoverMirror, hue: 45 },
  'schematerapia-vda': { Scene: CoverOwnFrame, hue: 290 },
  'zdoroviy-vzrosliy-bez-terapii': { Scene: CoverGrowth, hue: 70 },
  'schema-terapiya-vs-razgovornaya-terapiya': { Scene: CoverTalkMap, hue: 240 },
  'schema-terapiya-pri-perfektsionizme': { Scene: CoverBar, hue: 195 },
  'skolko-dlitsya-schema-terapiya': { Scene: CoverStages, hue: 45 },
  'povtoryayushchiesya-patterny-v-otnosheniyah': { Scene: CoverLoop, hue: 290 },
  'schema-terapiya-vs-kpt': { Scene: CoverDepth, hue: 70 },
  'pervaya-sessiya-schema-terapii': { Scene: CoverFirstSession, hue: 240 },
  'schema-terapiya-pri-travme': { Scene: CoverMended, hue: 45 },
  'schema-terapiya-pri-trevoge-i-depressii': { Scene: CoverCloud, hue: 135 },
  'podhodit-li-mne-schema-terapiya': { Scene: CoverScales, hue: 290 },
  'rezhimy-v-schema-terapii': { Scene: CoverModes, hue: 70 },
  'skhemy-yanga-spisok': { Scene: CoverSchemaStacks, hue: 240 },
  'chto-takoe-schema-terapiya': { Scene: CoverRoots, hue: 195 },
};

/** Своя сцена статьи; slug задаёт админка, поэтому только собственные ключи (не `constructor`). */
export const articleCoverLook = (slug: string): CoverLook | undefined =>
  Object.hasOwn(ARTICLE_COVERS, slug) ? ARTICLE_COVERS[slug] : undefined;

/** Бумага обложки без своей сцены — по порядку карточки: соседние разного оттенка. */
const FALLBACK_HUE = [135, 45, 240] as const;

export function articleCoverHue(slug: string, index: number): number {
  return articleCoverLook(slug)?.hue ?? FALLBACK_HUE[((index % 3) + 3) % 3];
}
