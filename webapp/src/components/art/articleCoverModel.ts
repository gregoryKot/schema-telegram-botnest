// Обложки статей: у каждой статьи своя сцена из языка знаков и своя бумага (docs/design/
// PAPER_2026-11.md, таблица «Обложки статей»). Здесь только бумага по slug — лёгкие данные
// для главного чанка; сами сцены — articleCoverScenes.ts, их грузит отдельный чанк
// (ArticleSceneArt.tsx через React.lazy): обложки нужны лендингу и статьям, а не кабинету
// (бандл-храповик, 2026-11-08). Ключи двух таблиц совпадают — сверка в articleCoverModel.test.tsx,
// там же сверка с сидом (src/articles/articles.seed.ts). Статья без своей сцены (новая из
// админки) получает листы веером SceneCover по порядку карточки. Фото-обложек нет: растр мимо
// стиля (принцип 3). Бумага — чтобы три соседние по дате статьи были разных оттенков.

/** slug → оттенок бумаги (--h). Порядок — от новых статей к старым, как в списке. */
export const ARTICLE_COVER_HUE: Readonly<Record<string, number>> = {
  'schema-terapiya-pri-nizkoy-samootsenke': 45,
  'schematerapia-vda': 290,
  'zdoroviy-vzrosliy-bez-terapii': 70,
  'schema-terapiya-vs-razgovornaya-terapiya': 240,
  'schema-terapiya-pri-perfektsionizme': 195,
  'skolko-dlitsya-schema-terapiya': 45,
  'povtoryayushchiesya-patterny-v-otnosheniyah': 290,
  'schema-terapiya-vs-kpt': 70,
  'pervaya-sessiya-schema-terapii': 240,
  'schema-terapiya-pri-travme': 45,
  'schema-terapiya-pri-trevoge-i-depressii': 135,
  'podhodit-li-mne-schema-terapiya': 290,
  'rezhimy-v-schema-terapii': 70,
  'skhemy-yanga-spisok': 240,
  'chto-takoe-schema-terapiya': 195,
};

/** Есть ли у статьи своя сцена; slug задаёт админка — только собственные ключи (не `constructor`). */
export const hasOwnCover = (slug: string): boolean => Object.hasOwn(ARTICLE_COVER_HUE, slug);

/** Бумага обложки без своей сцены — по порядку карточки: соседние разного оттенка. */
const FALLBACK_HUE = [135, 45, 240] as const;

export function articleCoverHue(slug: string, index: number): number {
  return hasOwnCover(slug) ? ARTICLE_COVER_HUE[slug] : FALLBACK_HUE[((index % 3) + 3) % 3];
}
