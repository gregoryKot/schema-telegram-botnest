// Страница ссылок визитки (kotlarewski.gr/links) — одна ссылка для шапок соцсетей:
// фото, имя и столбик кнопок. Статична, данных не грузит. Кнопки — обычные <a href>
// в той же вкладке: так предсказуемо во встроенных браузерах Telegram и Instagram.
import { AuthorAvatar } from '../../components/AuthorAvatar';
import { ThemeIcon } from '../../components/landing-kit';
import { useTheme } from '../../components/landing-kit-hooks';
import { readyLinks, type ReadyLink } from './linksData';
import { trackLinksClick } from './trackLinksClick';
import '../../styles/links-page.css';

const isExternal = (href: string) => /^https?:/.test(href);

function LinkButton({ link }: { link: ReadyLink }) {
  const arrow = isExternal(link.href) ? '↗' : '→';
  return (
    <li className="lk-item">
      <a className={`lk lk-${link.kind}`} href={link.href} onClick={() => trackLinksClick(link.id)}>
        <span className="lk-text">
          {link.kind === 'feature' && <span className="lk-eyebrow">Проект</span>}
          <span className="lk-title">{link.title}</span>
          {link.note && <span className="lk-note">{link.note}</span>}
        </span>
        <span className="lk-arrow" aria-hidden>{arrow}</span>
      </a>
    </li>
  );
}

export function LinksPage() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <main className="links-page">
      <div className="links-col">
        <button type="button" className="links-theme" onClick={toggle} aria-label={dark ? 'Светлая тема' : 'Тёмная тема'}>
          <ThemeIcon dark={dark} />
        </button>
        <header className="links-head">
          <AuthorAvatar photo="/gregory.jpg" size={88} letterSize={34} />
          <h1 className="links-name">Григорий Котляревский</h1>
          <p className="links-about">Работаю в подходе схема-терапия · онлайн</p>
        </header>
        <nav aria-label="Ссылки">
          <ul className="links-list">
            {readyLinks().map((link) => <LinkButton key={link.id} link={link} />)}
          </ul>
        </nav>
      </div>
    </main>
  );
}
