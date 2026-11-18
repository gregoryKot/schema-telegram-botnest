// Встроенная статья сайта: общий тип сида (articles.seed.ts и его части по месяцам).
export interface ArticleSeed {
  slug: string;
  title: string;
  description: string;
  date: string;
  readMin: number;
  content: string;
}
