// Строки общего поиска «Статьи»: опубликованные статьи сайта (usePaletteClientData.ts), у обеих ролей.
// Ищутся по названию и описанию; строка открывает страницу статьи.
import type { CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteInput';

export const ARTICLE_GROUP = 'Статьи';

/** Подзаголовок строки — первое предложение описания: целиком оно занимает пять строк и вытесняет выдачу. */
export const articleLead = (description: string): string | undefined => description.match(/^.+?[.!?…](?=\s|$)/)?.[0] ?? (description || undefined);

export function allArticleRows({ articles, run }: PaletteInput): CmdRow[] {
  return articles.map((a) => ({
    key: `article:${a.slug}`, kind: 'article', group: ARTICLE_GROUP, label: a.title, sub: articleLead(a.description),
    mark: { sign: 'sheets' }, search: `${a.title} ${a.description}`,
    action: () => run.path(`/articles/${a.slug}`),
  }));
}
