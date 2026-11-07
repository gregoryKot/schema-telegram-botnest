import { useHistorySheet } from '../../hooks/useHistorySheet';
import { Cta } from './BrandKit';
import { NAV_LINKS } from './productContent';
import { entryCta, type EntryCta } from './entryCta';
import { scrollIntoViewSafe } from '../../../../shared/src/utils/scrollIntoView';

// Мобильное меню продуктового лендинга (В4, аудит 2026-08) — .pl2-nav
// исчезал ≤640px без замены, ссылки становились недостижимы с телефона.
// Бумага кабинета, как весь лендинг (styles/product-landing.css), не серийная
// nav.tsx личного сайта терапевта — два разных бренда. Fullscreen-оверлей ⇒ useHistorySheet.
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Меню"
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        padding: 'calc(18px + var(--safe-top)) 24px calc(28px + var(--safe-bottom))',
        color: 'var(--text)', fontFamily: 'var(--sans)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button
          onClick={goBack}
          aria-label="Закрыть меню"
          style={{
            width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {NAV_LINKS.map((l, i) => (
          <a
            key={l.href}
            href={l.href}
            onClick={(e) => { e.preventDefault(); go(l.href); }}
            style={{
              padding: '16px 4px', fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400,
              color: 'var(--text)', textDecoration: 'none',
              borderBottom: i === NAV_LINKS.length - 1 ? 'none' : '1px solid var(--paper-sunk)',
            }}
          >
            {l.label}
          </a>
        ))}
      </nav>
      <div className="pl2-actions" style={{ marginTop: 16 }}>
        <Cta href={entry.href} size="lg">{entry.nav}</Cta>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '14px 0 0', textAlign: 'center' }}>
        Схема-терапия · бесплатно · без рекламы
      </p>
    </div>
  );
}
