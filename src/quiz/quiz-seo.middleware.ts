import type { Request, Response } from 'express';
import { injectSeo } from '../articles/article-seo.render';
import type { LandingText } from '../booking/landing-price';
import { REVALIDATE } from '../infra/static-cache';
import { PRACTICE_ALIAS_HOSTS } from '../practice-domain.middleware';
import { quizSeoPage } from './quiz-seo.render';

/** GET /tests и /tests/:id на хосте приложения → index.html с meta и текстом
 *  теста; неизвестный id, алиас-хост или нет сборки — дальше (ServeStatic). */
export function quizSeoMiddleware(
  html: string | null,
  landingText: LandingText,
  aliasHosts: ReadonlySet<string> = PRACTICE_ALIAS_HOSTS,
) {
  return async (req: Request, res: Response, next: () => void) => {
    const page = quizSeoPage(req.path.replace(/\/+$/, ''));
    if (!html || !page || aliasHosts.has(req.hostname)) {
      next();
      return;
    }
    const body = await landingText(injectSeo(html, page));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', REVALIDATE);
    res.send(body);
  };
}
