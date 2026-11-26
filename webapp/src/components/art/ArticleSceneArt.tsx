// Своя сцена статьи — вход отдельного чанка: ArticleCover.tsx грузит модуль через React.lazy,
// и пятнадцать рисунков (articleCoverScenes.ts) не лежат в главном чанке, который качает и
// кабинет. Пока чанк едет, рамка уже стоит цветной бумагой нужного оттенка — макет не прыгает.
import { articleSceneElement } from './articleCoverScenes';

export default function ArticleSceneArt({ slug, hue }: { slug: string; hue: number }) {
  return articleSceneElement(slug, hue);
}
