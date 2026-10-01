import { Btn, ThemeIcon } from '../../components/landing-kit';
import type { useTheme } from '../../components/landing-kit-hooks';
import { TG_URL, menuBtnStyle, burgerLine } from './constants';
import { TgLink, SectionNav } from './nav';
import { AuthorAvatar } from './AuthorAvatar';
import { hideOnError } from './hideOnError';

type Theme = ReturnType<typeof useTheme>['theme'];

interface HeroSectionProps {
  /** Адрес фото терапевта (из админки либо /gregory.jpg по умолчанию). */
  photo: string;
  /** Активный раздел (scrollspy) — подсвечивает пункт навигации. */
  activeSection: string;
  theme: Theme;
  onToggleTheme: () => void;
  onBook: () => void;
  onOpenMenu: () => void;
}

// Первый экран визитки: навигация, заголовок, абзац с кнопками и лицо автора.
// Разметка адаптивна через .hero-below / .hero-person в LandingStyles:
// на десктопе портрет справа от текста, на телефоне он скрыт — единственное
// фото на первом экране это аватар в навигации (решение владельца 2026-10-01).
export function HeroSection({ photo, activeSection, theme, onToggleTheme, onBook, onOpenMenu }: HeroSectionProps) {
  return (
    <div className="hero-wrap" style={{ position: 'relative', zIndex: 1 }}>

      {/* ── Nav ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '26px 0', animation: 'hero-in .5s both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Имя + фото → Обо мне */}
          <a href="#about" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}
            onMouseEnter={e => { const n = e.currentTarget.querySelector('.nav-name') as HTMLElement | null; if (n) n.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { const n = e.currentTarget.querySelector('.nav-name') as HTMLElement | null; if (n) n.style.color = 'var(--text)'; }}>
            <AuthorAvatar photo={photo} size={34} letterSize={14} />
            <span className="nav-name" style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--text)', whiteSpace: 'nowrap', transition: 'color .15s' }}>Григорий Котляревский</span>
          </a>
        </div>
        <SectionNav className="hero-nav" active={activeSection} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
          <button
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)', transition: 'border-color .15s, color .15s', padding: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-sub)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}
          >
            <ThemeIcon dark={theme === 'dark'} />
          </button>
          <a href={TG_URL} target="_blank" rel="noopener noreferrer"
            className="nav-tg"
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-sub)', textDecoration: 'none', transition: 'color .15s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}>
            Написать ↗
          </a>
          <button className="menu-btn" aria-label="Открыть меню" onClick={onOpenMenu} style={menuBtnStyle}>
            <span style={burgerLine} /><span style={burgerLine} /><span style={burgerLine} />
          </button>
        </div>
      </div>

      {/* ── Eyebrow ── */}
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', margin: '20px 0 20px', animation: 'hero-in .6s .15s both' }}>
        Схема-терапия · Онлайн
      </p>

      {/* ── Full-width headline – the centrepiece ── */}
      <h1 className="hero-h1" style={{
        fontFamily: 'var(--serif)',
        fontSize: 'clamp(44px, 9vw, 120px)',
        fontWeight: 400, lineHeight: 1.0, letterSpacing: '-.025em',
        color: 'var(--text)', margin: 0,
      }}>
        <span style={{ display: 'block', overflow: 'hidden' }}>
          <span style={{ display: 'block', animation: 'line-in .75s .2s both' }}>Работа с тем,</span>
        </span>
        <span style={{ display: 'block', overflow: 'hidden' }}>
          <span style={{ display: 'block', animation: 'line-in .75s .38s both', fontStyle: 'italic', color: 'var(--accent)' }}>что мешает</span>
        </span>
        <span style={{ display: 'block', overflow: 'hidden' }}>
          <span style={{ display: 'block', animation: 'line-in .75s .56s both' }}>жить</span>
        </span>
      </h1>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'var(--line-strong)', margin: '36px 0', animation: 'hero-in .5s .7s both' }} />

      {/* ── Below divider: текст + лицо автора (раскладка колонок — в LandingStyles) ── */}
      <div className="hero-below">
        <div className="hero-text" style={{ maxWidth: 460, animation: 'hero-in .7s .8s both' }}>
          <p style={{ fontSize: 17, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 28px' }}>
            Одни и те же сценарии повторяются – в отношениях, в самооценке, в тревоге. Схема-терапия помогает понять, почему так, – и найти выход.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Btn size="lg" onClick={onBook}>Записаться на знакомство →</Btn>
            <TgLink label="Написать в Telegram" size="lg" />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '18px 0 0' }}>
            Первая встреча бесплатно · 15 минут · без обязательств
          </p>
        </div>
        <figure className="hero-person" style={{ animation: 'hero-in .7s .8s both' }}>
          <img
            className="hero-person-photo"
            src={photo}
            alt="Григорий Котляревский"
            width={200}
            height={250}
            decoding="async"
            style={{ objectFit: 'cover', objectPosition: 'center 20%', display: 'block', background: 'var(--surface-2)' }}
            onError={hideOnError}
          />
          <figcaption>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Григорий Котляревский</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>Схема-терапия и КПТ · онлайн</div>
          </figcaption>
        </figure>
      </div>

      {/* ── Subtle scroll cue ── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0 28px', animation: 'hero-in .5s 1.1s both' }}>
        <div style={{ width: 1, height: 28, background: 'var(--line-strong)', animation: 'scroll-bar 2s ease-in-out infinite' }} />
      </div>

    </div>
  );
}
