// Какую разметку статьи пропускает серверный рендер для краулеров
// (article-html-sanitize.ts). Копия allowlist'а DOMPurify на клиенте —
// webapp/src/pages/ArticlesPage.tsx (`ALLOWED_TAGS` / `ALLOWED_ATTR`).
// Бэкенд не импортирует ни webapp, ни shared (rootDir — src), поэтому список
// продублирован, а совпадение держит тест-сверка
// article-html-allowlist.spec.ts (правило №4): тег, добавленный на клиенте,
// без строки здесь роняет jest — и наоборот.
// prettier-ignore
export const ARTICLE_ALLOWED_TAGS = [
  'h2', 'h3', 'p', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'hr', 'table',
  'thead', 'tbody', 'tr', 'th', 'td', 'a', 'br',
  // Схемы-рисунки (SVG). Без <marker>/<script> — стрелки рисуются полигонами.
  'figure', 'figcaption', 'svg', 'g', 'path', 'rect', 'circle', 'ellipse',
  'line', 'polyline', 'polygon', 'text', 'tspan', 'defs',
] as const;

// prettier-ignore
export const ARTICLE_ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class', 'viewBox', 'role', 'aria-label',
  'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points',
  'transform', 'text-anchor', 'width', 'height', 'opacity', 'font-size',
] as const;

/** Атрибуты-адреса: значение проверяется на схему (javascript:, data: — нет). */
export const ARTICLE_URI_ATTR = ['href'] as const;
