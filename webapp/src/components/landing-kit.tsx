/* eslint-disable react-refresh/only-export-components -- файл намеренно держит компонент рядом с его константами/хуками; вынос в отдельный файл — churn ради dev-only Fast Refresh, на прод-рантайм не влияет */
import { useState, useRef, useEffect, useCallback } from 'react';
import { api, type ArticleSummary } from '../api';

// Shared primitives for landing pages (LandingPage — терапевт, ProductLandingPage — продукт).
// Moved verbatim from LandingPage.tsx; keep behaviour identical for both pages.

// ─── Design tokens ────────────────────────────────────────────────────────────
export const R = { pill: 100, card: 24, btn: 12, badge: 14 } as const;   // radius
export const DARK_BG = '#1c1916';     // intentional always-dark sections
export const INK_ON_DARK = '#eceae5'; // text on dark sections

// ─── Button – single source for all CTAs ─────────────────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'dark';
type BtnSize = 'sm' | 'md' | 'lg';
const BTN_PAD: Record<BtnSize, string> = { sm: '8px 18px', md: '13px 24px', lg: '15px 30px' };
const BTN_FS:  Record<BtnSize, number> = { sm: 13, md: 14, lg: 15 };

export function Btn({
  children, variant = 'primary', size = 'md', radius = 'pill',
  href, onClick, type = 'button', full = false, disabled = false, style, newTab,
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  radius?: 'pill' | 'btn';
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  full?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  /** Override new-tab behaviour. Defaults to true for http links, false for relative. */
  newTab?: boolean;
}) {
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff', boxShadow: '0 8px 28px rgba(77,71,153,.28)' },
    ghost:   { background: 'transparent', borderColor: 'var(--line-strong)', color: 'var(--text-sub)', fontWeight: 500 },
    dark:    { background: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.2)', color: INK_ON_DARK },
  };
  const css: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: BTN_PAD[size], fontSize: BTN_FS[size], fontWeight: 700, fontFamily: 'inherit',
    borderRadius: radius === 'pill' ? R.pill : R.btn,
    border: '1.5px solid transparent', boxSizing: 'border-box',
    cursor: disabled ? 'default' : 'pointer', textDecoration: 'none',
    width: full ? '100%' : undefined, opacity: disabled ? 0.4 : 1,
    transition: 'transform .15s, box-shadow .15s, background .15s, border-color .15s, color .15s',
    ...variants[variant], ...style,
  };
  const enter = (e: React.MouseEvent) => {
    if (disabled) return;
    const el = e.currentTarget as HTMLElement;
    if (variant === 'primary') { el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 40px rgba(77,71,153,.4)'; }
    else if (variant === 'ghost') { el.style.borderColor = 'var(--text)'; el.style.color = 'var(--text)'; }
    else { el.style.background = 'rgba(255,255,255,.18)'; }
  };
  const leave = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.transform = '';
    el.style.boxShadow = variant === 'primary' ? '0 8px 28px rgba(77,71,153,.28)' : '';
    if (variant === 'ghost') { el.style.borderColor = 'var(--line-strong)'; el.style.color = 'var(--text-sub)'; }
    if (variant === 'dark') { el.style.background = 'rgba(255,255,255,.1)'; }
  };
  if (href) {
    const ext = href.startsWith('http');
    const openNewTab = newTab !== undefined ? newTab : ext;
    return <a href={href} target={openNewTab ? '_blank' : undefined} rel={ext ? 'noopener noreferrer' : undefined}
      style={css} onMouseEnter={enter} onMouseLeave={leave}>{children}</a>;
  }
  return <button type={type} onClick={onClick} disabled={disabled} style={css} onMouseEnter={enter} onMouseLeave={leave}>{children}</button>;
}

// ─── Theme toggle icon – crisp sun/moon (no unicode glyph rendering issues) ──
export function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

// ─── Scroll reveal – IntersectionObserver with deep-link / in-view failsafe ──
export function useReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Failsafe: if we loaded via a hash (deep link jumps past sections) or the
    // section is already on screen, reveal now. Otherwise the observer's first
    // callback can fail to arrive until the user scrolls, leaving content hidden.
    const r = el.getBoundingClientRect();
    if (window.location.hash || (r.top < window.innerHeight && r.bottom > 0)) {
      el.classList.add('revealed');
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('revealed'); obs.disconnect(); } },
      { threshold: 0.08 },
    );
    obs.observe(el);
    // Safety net: never leave a section permanently hidden if the observer is
    // throttled or misfires (past bug: blank sections). Force-reveal after 2.5s.
    const fallback = window.setTimeout(() => el.classList.add('revealed'), 2500);
    return () => { obs.disconnect(); window.clearTimeout(fallback); };
  }, []);
  return ref;
}

// ─── Card hover tilt ──────────────────────────────────────────────────────────
export function useTilt<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) translateY(-6px)`;
      el.style.boxShadow = '0 20px 60px rgba(28,25,20,.16)';
    };
    const onLeave = () => { el.style.transform = ''; el.style.boxShadow = ''; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, []);
  return ref;
}

// ─── Recent articles (shared by both landings) ───────────────────────────────
// Returns null while loading, [] on empty/failed. Both landing pages surface
// the same /articles content, so the fetch + trim lives here once.
export function useRecentArticles(limit = 3) {
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
  useEffect(() => {
    api.listArticles()
      .then((a) => setArticles(a.slice(0, limit)))
      .catch(() => setArticles([]));
  }, [limit]);
  return articles;
}

// ─── Theme toggle state ───────────────────────────────────────────────────────
export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('app_theme') === 'dark' ? 'dark' : 'light';
  });
  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    localStorage.setItem('app_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }, [theme]);
  return { theme, toggle };
}
