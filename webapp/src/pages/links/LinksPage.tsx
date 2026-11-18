// Страница ссылок визитки (kotlarewski.gr/links) — одна ссылка для шапок соцсетей:
// фото, имя и столбик пунктов. Статична, данных не грузит. Ссылки — обычные <a href>
// в той же вкладке: так предсказуемо во встроенных браузерах Telegram и Instagram.
import { AuthorAvatar } from '../../components/AuthorAvatar';
import { ThemeIcon } from '../../components/landing-kit';
import { useTheme } from '../../components/landing-kit-hooks';
import { LINKS } from './linksData';
import { readyLinks } from './linksModel';
import { LinkRow } from './LinkRow';
import '../../styles/links-page.css';

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
          <span className="links-photo"><AuthorAvatar photo="/gregory.jpg" size={88} letterSize={34} /></span>
          <h1 className="links-name">Григорий Котляревский</h1>
          <p className="links-about">Работаю в подходе схема-терапия · онлайн</p>
        </header>
        <nav aria-label="Ссылки">
          <ul className="links-list">
            {readyLinks(LINKS).map((link) => <LinkRow key={link.title} link={link} />)}
          </ul>
        </nav>
      </div>
    </main>
  );
}
