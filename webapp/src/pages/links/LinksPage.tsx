// Страница ссылок визитки (kotlarewski.gr/privet) — одна ссылка для шапок соцсетей:
// фотокарточка, кнопка записи, проект, записка и список. Статична, данных не грузит.
// Ссылки — обычные <a href> в той же вкладке: так предсказуемо во встроенных браузерах.
import { ThemeIcon } from '../../components/landing-kit';
import { useTheme } from '../../components/landing-kit-hooks';
import { LINKS } from './linksData';
import { readyLinks } from './linksModel';
import { LinkRow } from './LinkRow';
import { LinksHero } from './LinksHero';
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
        <LinksHero />
        <nav aria-label="Ссылки">
          <ul className="links-list">
            {readyLinks(LINKS).map((link) => <LinkRow key={link.title} link={link} />)}
          </ul>
        </nav>
      </div>
    </main>
  );
}
