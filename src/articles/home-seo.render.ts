import { esc } from './article-seo.render';
import {
  HOME_FAQ,
  HOME_FEATURES,
  HOME_FINAL,
  HOME_HEADINGS,
  HOME_HERO,
  HOME_STEPS,
  HOME_TRUST,
  type RichText,
} from './home-landing.content';

// HTML главной schemehappens.ru для робота без JS: тот же текст, что рисует
// ProductLandingPage, из одного источника (home-landing.content.ts). Порядок
// разделов — как на странице. Только смысл: без стилей, картинок и кнопок
// входа; React при монтировании заменит содержимое #root (createRoot, не
// hydrate), человек видит обычную страницу.

const rich = (parts: RichText): string =>
  parts
    .map((p) =>
      typeof p === 'string'
        ? esc(p)
        : `<a href="${esc(p.href)}">${esc(p.text)}</a>`,
    )
    .join('');

const card = (title: string, body: string): string =>
  `<li><h3>${esc(title)}</h3><p>${body}</p></li>`;

/** Содержимое #root главной для робота. Чистая функция без входа: текст
 *  статичен, вызывающий кэширует результат. */
export function buildHomeBody(): string {
  const t = HOME_HERO.title;
  const hero =
    `<h1>${esc(t.before + t.accent + t.after)}</h1>` +
    `<p>${esc(HOME_HERO.lead)}</p>`;
  const how =
    `<section><h2>${esc(HOME_HEADINGS.how)}</h2><ol>` +
    HOME_STEPS.map((s) => card(s.title, esc(s.text))).join('') +
    `</ol></section>`;
  const features =
    `<section><h2>${esc(HOME_HEADINGS.features)}</h2><ul>` +
    HOME_FEATURES.map((f) => card(f.title, esc(f.text))).join('') +
    `</ul></section>`;
  const trust =
    `<section><ul>` +
    HOME_TRUST.map((x) => card(x.title, rich(x.text))).join('') +
    `</ul></section>`;
  const faq =
    `<section><h2>${esc(HOME_HEADINGS.faq)}</h2>` +
    HOME_FAQ.map((f) => `<h3>${esc(f.q)}</h3><p>${rich(f.a)}</p>`).join('') +
    `</section>`;
  const final =
    `<section><h2>${esc(HOME_FINAL.title)}</h2>` +
    `<p>${esc(HOME_FINAL.text)}</p></section>`;
  return `<main>${hero}${how}${features}${trust}${faq}${final}</main>`;
}
