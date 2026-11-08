import type { CSSProperties } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { Logo, Cta } from './BrandKit';
import { NAV_LINKS } from './productContent';
import { entryCta, type EntryCta } from './entryCta';
import { scrollIntoViewSafe } from '../../../../shared/src/utils/scrollIntoView';
import { SignScene } from '../../components/art/SceneParts';
import { BrandMark } from '../../components/art/BrandMark';
import '../../styles/product-landing-menu.css';

// Мобильное меню продуктового лендинга (В4, аудит 2026-08) — .pl2-nav исчезает
// ≤960px, ссылки остаются достижимы отсюда. Язык бумаги, как весь лендинг: пункты —
// плитки цветной бумаги; у секции с полосой — оттенка полосы (NAV_LINKS[].hue из BAND_HUE:
// солома, небо, шалфей), не серийная nav.tsx личного сайта терапевта. Внизу плитки — знак
// секции (NAV_LINKS[].Art, у «Приложения» — значок продукта) и стрелка.
// Вид — styles/product-landing-menu.css. Fullscreen-оверлей ⇒ useHistorySheet.

export function ProductMobileMenu({ onClose, entry = entryCta(false) }: { onClose: () => void; entry?: EntryCta }) {
  const goBack = useHistorySheet(onClose);

  const go = (href: string) => {
    if (href.startsWith('#')) {
      goBack();
      setTimeout(
        () => scrollIntoViewSafe(document.getElementById(href.slice(1))),
        60,
      );
    } else {
      window.location.assign(href);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Меню" className="light-lock pl2-menu">
      <div className="pl2-menu-head">
        <Logo />
        <button onClick={goBack} aria-label="Закрыть меню" className="pl2-menu-close">×</button>
      </div>
      <nav className="pl2-menu-nav">
        {NAV_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            onClick={(e) => { e.preventDefault(); go(l.href); }}
            className="pp-paper pl2-menu-link"
            style={{ '--h': l.hue } as CSSProperties}
          >
            {l.label}
            <span aria-hidden="true" className="pl2-menu-foot">
              <span className="pl2-menu-sign">{l.Art ? <SignScene Art={l.Art} /> : <BrandMark size={40} />}</span>
              <span className="pl2-menu-arrow">→</span>
            </span>
          </a>
        ))}
      </nav>
      <div className="pl2-actions pl2-menu-cta">
        <Cta href={entry.href} size="lg">{entry.nav}</Cta>
      </div>
      <p className="pl2-menu-fine">Схема-терапия · бесплатно · без рекламы</p>
    </div>
  );
}
