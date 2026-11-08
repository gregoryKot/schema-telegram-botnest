// Сцены обложек статей по slug — тяжёлая половина модели (articleCoverModel.ts — бумага).
// Импортирует только ArticleSceneArt.tsx (отдельный чанк через React.lazy) и тесты: в главный
// чанк рисунки не попадают. Ключи совпадают с ARTICLE_COVER_HUE — сверка в
// articleCoverModel.test.tsx. Отдельный файл: модули компонентов экспортируют только компоненты.
import { createElement, type ReactElement } from 'react';
import { CoverDepth, CoverModes, CoverRoots, CoverSchemaStacks, CoverTalkMap } from './ArticleScenesMethod';
import { CoverFirstSession, CoverGrowth, CoverScales, CoverStages } from './ArticleScenesPath';
import { CoverBar, CoverCloud, CoverMended } from './ArticleScenesHelp';
import { CoverLoop, CoverMirror, CoverOwnFrame } from './ArticleScenesSelf';

export type CoverScene = (p: { hue: number }) => ReactElement;

export const ARTICLE_SCENES: Readonly<Record<string, CoverScene>> = {
  'schema-terapiya-pri-nizkoy-samootsenke': CoverMirror,
  'schematerapia-vda': CoverOwnFrame,
  'zdoroviy-vzrosliy-bez-terapii': CoverGrowth,
  'schema-terapiya-vs-razgovornaya-terapiya': CoverTalkMap,
  'schema-terapiya-pri-perfektsionizme': CoverBar,
  'skolko-dlitsya-schema-terapiya': CoverStages,
  'povtoryayushchiesya-patterny-v-otnosheniyah': CoverLoop,
  'schema-terapiya-vs-kpt': CoverDepth,
  'pervaya-sessiya-schema-terapii': CoverFirstSession,
  'schema-terapiya-pri-travme': CoverMended,
  'schema-terapiya-pri-trevoge-i-depressii': CoverCloud,
  'podhodit-li-mne-schema-terapiya': CoverScales,
  'rezhimy-v-schema-terapii': CoverModes,
  'skhemy-yanga-spisok': CoverSchemaStacks,
  'chto-takoe-schema-terapiya': CoverRoots,
};

/** Сцена статьи; slug задаёт админка — только собственные ключи. */
export const articleCoverScene = (slug: string): CoverScene | undefined =>
  Object.hasOwn(ARTICLE_SCENES, slug) ? ARTICLE_SCENES[slug] : undefined;

/** Сцена статьи готовым элементом или null. Выбор компонента — здесь, вне рендера: компонент,
 *  вычисленный в теле другого компонента, react-hooks считает созданным на каждый рендер. */
export function articleSceneElement(slug: string, hue: number): ReactElement | null {
  const Scene = articleCoverScene(slug);
  return Scene ? createElement(Scene, { hue }) : null;
}
