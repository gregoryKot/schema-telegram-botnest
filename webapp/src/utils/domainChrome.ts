// Пер-доменные правки <head>: index.html один на оба домена (продуктовый
// schemehappens и персональный kotlarewski*), различия наводятся уже из JS.
// Персональному сайту — свой фавикон и никакого манифеста приложения:
// ярлык «Всё по схеме» (start_url /app/) ставится только с продуктового
// домена, иначе визитка терапевта предлагала бы установить чужой продукт.
export function applyPersonalSiteChrome(doc: Document = document): void {
  doc.querySelectorAll("link[rel='icon']").forEach((el) => {
    const link = el as HTMLLinkElement;
    if (link.sizes?.value === '96x96') {
      link.href = '/favicon-personal-32.png';
    } else {
      link.type = 'image/png';
      link.href = '/favicon-personal-32.png';
    }
  });
  doc.querySelector("link[rel='manifest']")?.remove();
}
