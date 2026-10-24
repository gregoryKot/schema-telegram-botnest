// Страницы визитки в поиске (kotlarewski.gr, PRACTICE_INDEXED_PAGES: главная и
// /reviews) отдают тот же webapp/dist/index.html, что и schemehappens.ru, но со
// своими canonical и og:url — иначе поисковик и Telegram склеивают визитку с
// продуктом в одну карточку, а /reviews — с главной. Остальной <head>
// (og:image, JSON-LD) указывает на kotlarewski.gr уже в самом файле.
import type { Request, Response } from 'express';
import { PRACTICE_INDEXED_PAGES } from './practice-domain.seo';

const PRODUCT_ROOT = 'https://schemehappens.ru/';

export function practiceIndexHtml(
  html: string,
  domain: string,
  path = '/',
): string {
  const own = `https://${domain}${path}`;
  return html
    .replace(`href="${PRODUCT_ROOT}"`, `href="${own}"`)
    .replace(`content="${PRODUCT_ROOT}"`, `content="${own}"`);
}

/** GET страниц визитки в поиске: на хосте-алиасе — index.html со своим
 *  canonical; любой другой хост или путь — дальше, к ServeStatic. */
export function practiceIndexMiddleware(
  html: string | null,
  aliasHosts: ReadonlySet<string>,
) {
  return (req: Request, res: Response, next: () => void): void => {
    const path = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
    if (
      !html ||
      !aliasHosts.has(req.hostname) ||
      !PRACTICE_INDEXED_PAGES.includes(path)
    ) {
      next();
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(practiceIndexHtml(html, req.hostname, path));
  };
}
