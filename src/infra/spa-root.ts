// #root собранного index.html до первого рендера: пустой или с экраном загрузки
// (#boot — знак продукта, webapp/index.html). Сверка с настоящим файлом — в спеках
// home-seo.middleware, article-seo.render и practice-index-html.

/** Экран загрузки продукта; внутри один `</div>` — его собственный. */
export const BOOT_SCREEN = /<div id="boot">[\s\S]*?<\/div>/;

/** #root с экраном загрузки или пустой: готовый текст страницы (лендинг, статья) встаёт на его место. */
export const SPA_ROOT = new RegExp(
  `<div id="root">(?:${BOOT_SCREEN.source})?</div>`,
);
