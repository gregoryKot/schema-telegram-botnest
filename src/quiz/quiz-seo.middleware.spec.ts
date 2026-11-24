// Шов «реестр тестов → sitemap и серверные meta»: новый тест из QUIZ_IDS сам
// попадает в карту сайта и получает свои title/description/OG.
import express from 'express';
import request from 'supertest';
import { QUIZ_IDS, buildQuizzes } from './quiz-registry';
import { quizSeoMiddleware } from './quiz-seo.middleware';
import { quizDescription, quizSeoPage } from './quiz-seo.render';
import { buildSitemapXml } from '../articles/sitemap.middleware';
import { SITE_URL, esc } from '../articles/article-seo.render';

const BASE =
  `<!doctype html><html><head><title>t</title>` +
  `<meta name="description" content="d" />` +
  `<meta property="og:title" content="o" />` +
  `<meta property="og:description" content="o" />` +
  `<link rel="canonical" href="${SITE_URL}/" />` +
  `</head><body><div id="root"></div></body></html>`;

const landingText = (text: string) => Promise.resolve(text);

function buildApp(html: string | null = BASE) {
  const app = express();
  app.get('/{*path}', quizSeoMiddleware(html, landingText), (_req, res) => {
    res.send('SPA');
  });
  return app;
}

describe('реестр тестов → sitemap', () => {
  it('в карте /tests и каждый id из QUIZ_IDS на хосте приложения', () => {
    const xml = buildSitemapXml([]);
    expect(xml).toContain(`<loc>${SITE_URL}/tests</loc>`);
    for (const id of QUIZ_IDS) {
      expect(xml).toContain(`<loc>${SITE_URL}/tests/${id}</loc>`);
    }
    expect(xml).not.toContain('kotlarewski.gr');
  });
});

describe('quizSeoMiddleware', () => {
  const app = buildApp();

  it.each(buildQuizzes('ty'))(
    '/tests/$id → title, description из teaser «ты», canonical, OG',
    async (quiz) => {
      const res = await request(app)
        .get(`/tests/${quiz.id}`)
        .set('Host', 'schemehappens.ru');
      expect(res.status).toBe(200);
      const desc = esc(quizDescription(quiz));
      expect(res.text).toContain(`<title>${esc(quiz.title)} — мини-тест`);
      expect(res.text).toContain(
        `<meta name="description" content="${desc}" />`,
      );
      expect(res.text).toContain(
        `<meta property="og:description" content="${desc}" />`,
      );
      expect(res.text).toContain(
        `<link rel="canonical" href="${SITE_URL}/tests/${quiz.id}" />`,
      );
      expect(res.text).toContain(`<h1>${esc(quiz.title)}</h1>`);
    },
  );

  it('/tests → список со ссылкой на каждый тест', async () => {
    const res = await request(app)
      .get('/tests/')
      .set('Host', 'schemehappens.ru');
    expect(res.text).toContain(
      `<link rel="canonical" href="${SITE_URL}/tests" />`,
    );
    for (const id of QUIZ_IDS)
      expect(res.text).toContain(`href="/tests/${id}"`);
  });

  it('неизвестный id, чужой путь, алиас-хост, нет сборки → SPA', async () => {
    const host = 'schemehappens.ru';
    expect((await request(app).get('/tests/nope').set('Host', host)).text).toBe(
      'SPA',
    );
    expect((await request(app).get('/today').set('Host', host)).text).toBe(
      'SPA',
    );
    expect(
      (await request(app).get('/tests').set('Host', 'kotlarewski.gr')).text,
    ).toBe('SPA');
    expect(
      (await request(buildApp(null)).get('/tests').set('Host', host)).text,
    ).toBe('SPA');
  });
});

describe('quizDescription', () => {
  it('teaser с точкой на конце не даёт двойной точки', () => {
    const [quiz] = buildQuizzes('ty');
    expect(quizDescription({ ...quiz, teaser: 'Узнаешь главное.' })).toBe(
      'Узнаешь главное. Бесплатный мини-тест по схема-терапии без регистрации.',
    );
    expect(quizSeoPage('/tests/x/y')).toBeNull();
  });
});
