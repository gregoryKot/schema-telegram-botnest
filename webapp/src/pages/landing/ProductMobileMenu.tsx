import { useHistorySheet } from '../../hooks/useHistorySheet';
import { INK, GLASS_BORDER, VIOLET, glow } from './aurora';
import { Cta } from './BrandKit';
import { NAV_LINKS } from './productContent';

// Мобильное меню продуктового лендинга (В4, аудит 2026-08) — .pl2-nav
// исчезал ≤640px без замены, ссылки становились недостижимы с телефона.
// СВОЯ айдентика pl2 (тёмный холст + аврора), не серийная nav.tsx личного
// сайта терапевта — два разных бренда (см. шапку ProductLandingPage.tsx).
// Fullscreen-оверлей ⇒ useHistorySheet обязателен (CLAUDE.md).
export function ProductMobileMenu({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);

  const go = (href: string) => {
    if (href.startsWith('#')) {
      goBack();
      setTimeout(
        () => document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' }),
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
        position: 'fixed', inset: 0, zIndex: 200, background: '#0b0817',
        display: 'flex', flexDirection: 'column',
        padding: '18px 24px calc(28px + env(safe-area-inset-bottom, 0px))',
        color: INK, fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button
          onClick={goBack}
          aria-label="Закрыть меню"
          style={{
            width: 44, height: 44, borderRadius: 10, border: `1px solid ${GLASS_BORDER}`,
            background: 'rgba(255,255,255,.05)', color: INK, fontSize: 22, cursor: 'pointer',
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
              padding: '18px 4px', fontSize: 22, fontWeight: 800, letterSpacing: '-.01em',
              color: INK, textDecoration: 'none',
              borderBottom: i === NAV_LINKS.length - 1 ? 'none' : `1px solid ${GLASS_BORDER}`,
            }}
          >
            {l.label}
          </a>
        ))}
      </nav>
      <div style={{ marginTop: 16 }}>
        <Cta href="/login" size="lg">Войти</Cta>
      </div>
      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)', margin: '14px 0 0', textAlign: 'center' }}>
        Схема-терапия · бесплатно · без рекламы
      </p>
      {/* Тень авроры для визуального единства с остальным лендингом (см. AppPreview). */}
      <div
        aria-hidden
        style={{
          position: 'absolute', bottom: -80, left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 160, borderRadius: '50%', background: glow(VIOLET, 0.18),
          filter: 'blur(80px)', pointerEvents: 'none', zIndex: -1,
        }}
      />
    </div>
  );
}
