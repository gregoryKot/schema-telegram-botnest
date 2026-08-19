// @vitest-environment jsdom
// Пер-доменные правки <head>: на персональном домене фавикон меняется на
// personal-вариант, а манифест приложения (start_url /app/) убирается —
// иначе визитка терапевта предлагала бы установить «Всё по схеме».
import { describe, it, expect, beforeEach } from 'vitest';
import { applyPersonalSiteChrome } from './domainChrome';

function addLink(rel: string, href: string, sizes?: string): HTMLLinkElement {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (sizes) link.setAttribute('sizes', sizes);
  document.head.appendChild(link);
  return link;
}

beforeEach(() => {
  document.head.innerHTML = '';
});

describe('applyPersonalSiteChrome', () => {
  it('меняет фавиконы на personal-вариант', () => {
    const svg = addLink('icon', '/favicon.svg');
    const png = addLink('icon', '/favicon-96.png', '96x96');
    applyPersonalSiteChrome(document);
    expect(svg.href).toContain('/favicon-personal-32.png');
    expect(svg.type).toBe('image/png');
    expect(png.href).toContain('/favicon-personal-32.png');
  });

  it('убирает ссылку на манифест приложения', () => {
    addLink('manifest', '/manifest.webmanifest');
    applyPersonalSiteChrome(document);
    expect(document.querySelector("link[rel='manifest']")).toBeNull();
  });

  it('без манифеста в документе не падает', () => {
    expect(() => applyPersonalSiteChrome(document)).not.toThrow();
  });
});
