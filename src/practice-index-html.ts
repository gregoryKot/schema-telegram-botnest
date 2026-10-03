// Главная визитки (kotlarewski.gr) отдаёт тот же webapp/dist/index.html, что и
// schemehappens.ru, но со своими canonical и og:url — иначе поисковик и
// Telegram склеивают визитку с продуктом в одну карточку. Остальной <head>
// (og:image, JSON-LD) указывает на kotlarewski.gr уже в самом файле.
const PRODUCT_ROOT = 'https://schemehappens.ru/';

export function practiceIndexHtml(html: string, domain: string): string {
  return html
    .replace(`href="${PRODUCT_ROOT}"`, `href="https://${domain}/"`)
    .replace(`content="${PRODUCT_ROOT}"`, `content="https://${domain}/"`);
}
