// ─── Global styles for LandingPage (keyframes, grids, responsive rules) ──────
export function LandingStyles() {
  return (
    <style>{`
        html { scroll-behavior: smooth; }

        /* Sections already carry 64–88px of top padding which clears the
           58px sticky bar; only a small margin is needed so the heading
           isn't flush against the bar. */
        section[id] { scroll-margin-top: 12px; }

        /* Section nav (desktop) ⇄ hamburger (mobile/tablet) */
        .sticky-nav, .hero-nav { display: flex; }
        .menu-btn { display: none !important; }
        @media (max-width: 1200px) {
          .sticky-nav, .hero-nav { display: none !important; }
          .menu-btn { display: flex !important; }
          .desktop-inline { display: none !important; }
          .nav-tg { display: none !important; }
        }
        @keyframes menu-in      { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @keyframes menu-item-in { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: none; } }

        /* Respect reduced-motion: kill looping/entrance animation, keep content visible */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .15s !important;
            scroll-behavior: auto !important;
          }
          .reveal-section { opacity: 1 !important; transform: none !important; }
        }

        @keyframes hero-in    { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:none } }
        @keyframes line-in    { from { transform:translateY(110%) } to { transform:none } }
        @keyframes blob-float { 0%,100% { transform:translate(0,0) scale(1) } 50% { transform:translate(2%,2%) scale(1.03) } }
        @keyframes scroll-bar { 0%,100% { opacity:.3; transform:scaleY(.5) } 50% { opacity:1; transform:scaleY(1) } }
        @keyframes pulse-dot  { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.4; transform:scale(.65) } }
        @keyframes marquee-fwd { from { transform:translateX(0) } to { transform:translateX(-100%) } }
        @keyframes marquee-rev { from { transform:translateX(-100%) } to { transform:translateX(0) } }

        .reveal-section { opacity:0; transform:translateY(28px); transition:opacity .75s ease, transform .75s ease; }
        .reveal-section.revealed { opacity:1; transform:none; }

        /* Hero */
        .hero-wrap    { max-width:1100px; width:100%; margin:0 auto; padding:0 40px; display:flex; flex-direction:column; justify-content:space-between; min-height:100dvh; box-sizing:border-box; }
        @media (max-height:820px) {
          .hero-h1   { font-size:clamp(36px, 7vh, 80px) !important; }
          .hero-wrap { min-height:100dvh; }
        }


        /* Grids */
        .about-inner  { display:grid; grid-template-columns:2fr 3fr; gap:48px; align-items:start; }
        .bento-grid   { display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:auto auto; gap:16px; }
        .bento-tall   { grid-row:1/3; }
        .bento-wide   { grid-column:2/4; }
        .process-grid { display:grid; grid-template-columns:repeat(3,1fr); }
        .price-grid   { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .app-grid     { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center; }
        .form-grid    { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .edu-grid     { display:grid; grid-template-columns:1fr 2fr; gap:60px; align-items:start; }
        .work-grid    { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        .trust-grid   { display:grid; grid-template-columns:repeat(3,1fr); gap:40px; }
        .bound-grid   { display:grid; grid-template-columns:1fr 1.2fr; gap:48px; align-items:start; }

        input:focus, textarea:focus { border-color:var(--accent) !important; box-shadow:0 0 0 4px var(--accent-soft); }

        @media (max-width:600px) {
          .nav-tg     { font-size:12px; }
        }

        @media (max-width:900px) {
          .about-inner  { grid-template-columns:1fr; }
          .bento-grid   { grid-template-columns:1fr; }
          .bento-tall   { grid-row:auto; }
          .bento-wide   { grid-column:auto; }
          .process-grid { grid-template-columns:1fr; gap:32px; }
          .process-grid > div { border-left:none !important; padding:0 !important; }
          .price-grid   { grid-template-columns:1fr; }
          .app-grid     { grid-template-columns:1fr; }
          .edu-grid     { grid-template-columns:1fr; gap:28px; }
          .work-grid    { grid-template-columns:1fr; }
          .trust-grid   { grid-template-columns:1fr; gap:32px; }
          .bound-grid   { grid-template-columns:1fr; gap:28px; }
        }
        @media (min-width:601px) and (max-width:900px) {
          .work-grid    { grid-template-columns:1fr 1fr; }
        }
        @media (max-width:600px) {
          .form-grid  { grid-template-columns:1fr; }
          .hero-wrap, section, footer { padding-left:20px !important; padding-right:20px !important; }
        }
      `}</style>
  );
}
