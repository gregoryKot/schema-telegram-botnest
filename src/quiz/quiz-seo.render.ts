import { SITE_URL, esc, type SeoPage } from '../articles/article-seo.render';
import { buildQuizzes, getQuiz } from './quiz-registry';
import type { Quiz } from './quiz.types';

// Серверные title/description/OG и текст для /tests и /tests/:id: сайт — SPA,
// без этого поисковик видит тест пустым дублем главной. Тексты — из реестра
// тестов в форме «ты», как сайт показывает гостю.

const SUFFIX = 'Всё по схеме';
const LIST_HEADING = 'Мини-тесты по схема-терапии';
const LIST_DESCRIPTION =
  'Бесплатные мини-тесты по схема-терапии без регистрации: пара минут — и понятнее, что происходит внутри и что с этим делать.';

const paragraphs = (text: string): string =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join('');

/** teaser + пояснение, без двойной точки на стыке. */
export function quizDescription(quiz: Quiz): string {
  const teaser = quiz.teaser.trim().replace(/[.…]+$/, '');
  return `${teaser}. Бесплатный мини-тест по схема-терапии без регистрации.`;
}

/** Пути страниц тестов для sitemap: список и каждый тест реестра. */
export function quizSitemapPaths(): string[] {
  return ['/tests', ...buildQuizzes('ty').map((q) => `/tests/${q.id}`)];
}

function listPage(): SeoPage {
  const items = buildQuizzes('ty')
    .map(
      (q) =>
        `<li><a href="/tests/${esc(q.id)}">${esc(q.title)}</a> – ${esc(q.teaser)}</li>`,
    )
    .join('');
  return {
    title: `${LIST_HEADING} – ${SUFFIX}`,
    description: LIST_DESCRIPTION,
    canonicalUrl: `${SITE_URL}/tests`,
    ogType: 'website',
    bodyHtml: `<section><h1>${LIST_HEADING}</h1><ul>${items}</ul></section>`,
  };
}

function quizPage(quiz: Quiz): SeoPage {
  return {
    title: `${quiz.title} — мини-тест – ${SUFFIX}`,
    ogTitle: `${quiz.title} — мини-тест`,
    description: quizDescription(quiz),
    canonicalUrl: `${SITE_URL}/tests/${quiz.id}`,
    ogType: 'website',
    bodyHtml:
      `<article><h1>${esc(quiz.title)}</h1>` +
      `<p>${esc(quiz.teaser)}</p>${paragraphs(quiz.intro)}` +
      `<p><a href="/tests">Все мини-тесты</a></p></article>`,
  };
}

/** Путь без хвостового слэша → страница; null — не страница тестов
 *  или неизвестный id (SPA сама уведёт на /tests). */
export function quizSeoPage(path: string): SeoPage | null {
  if (path === '/tests') return listPage();
  const m = /^\/tests\/([a-z0-9_]+)$/i.exec(path);
  const quiz = m ? getQuiz('ty', m[1]) : null;
  return quiz ? quizPage(quiz) : null;
}
