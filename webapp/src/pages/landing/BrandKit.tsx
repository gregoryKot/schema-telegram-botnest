// Логотип и кнопка продуктовых страниц app-домена (ProductLandingPage, /tests).
// Одна механика — один компонент: логотип — тот же, что в сайдбаре кабинета
// (SidebarBrand), кнопка — ds-btn кабинета; размер лендинга — .pl2-cta--lg
// (styles/product-landing.css). Наведение — CSS ds-btn, без JS-обработчиков.
import { SidebarBrand } from '../../components/appShell/SidebarRail';

export function Logo() {
  return <SidebarBrand />;
}

export function Cta({ href, children, variant = 'primary', size = 'md', onClick }: { href: string; children: React.ReactNode; variant?: 'primary' | 'ghost'; size?: 'md' | 'lg'; onClick?: React.MouseEventHandler<HTMLAnchorElement> }) {
  const cls = ['ds-btn', 'pl2-cta', variant === 'ghost' && 'ds-btn--secondary', size === 'lg' && 'pl2-cta--lg'].filter(Boolean).join(' ');
  const ext = href.startsWith('http');
  return (
    <a href={href} target={ext ? '_blank' : undefined} rel={ext ? 'noopener noreferrer' : undefined} className={cls} onClick={onClick}>
      {children}
    </a>
  );
}
