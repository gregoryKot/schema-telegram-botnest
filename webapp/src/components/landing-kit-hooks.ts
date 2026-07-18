import { useState, useRef, useEffect, useCallback } from 'react';
import { api, type ArticleSummary } from '../api';

// Shared non-component primitives for landing pages (tokens + hooks). Split out
// of landing-kit.tsx so that file exports only components (Fast Refresh).

// ─── Design tokens ────────────────────────────────────────────────────────────
export const R = { pill: 100, card: 24, btn: 12, badge: 14 } as const;   // radius
export const DARK_BG = '#1c1916';     // intentional always-dark sections
export const INK_ON_DARK = '#eceae5'; // text on dark sections

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
